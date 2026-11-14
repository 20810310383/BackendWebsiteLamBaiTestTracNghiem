const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const jwt = require('jsonwebtoken');
const NguoiDung = require('./models/NguoiDung');
const createPresence = require('./realtime/presence');

const PORT = process.env.PORT || 8821;

// 🟢 1. Tạo HTTP Server từ Express App
const server = http.createServer(app);

// 🟢 2. Khởi tạo Socket.io gắn vào Server đó
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:2004", "http://localhost:2003", "https://ktquizz.vercel.app", "https://vuaquiz.com"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// 🟢 3. "Gắn" io vào app để dùng được ở mọi nơi (Controller)
app.set("socketio", io);
const presence = createPresence(io);
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await NguoiDung.findById(decoded.id);
    if (!user || !user.isActive || user.currentToken !== token) throw new Error('Unauthorized');
    socket.data.user = user;
    next();
  } catch { next(new Error('Unauthorized')); }
});

// 🟢 4. Lắng nghe kết nối
io.on("connection", (socket) => {
  const user = socket.data.user;
  socket.join(`user:${user.id}`);
  presence.register(socket);
  if (user.role === 'admin') socket.join('admins');
  socket.on('clock:sync', (reply) => { if (typeof reply === 'function') reply({ now: Date.now() }); });
  console.log("⚡ Có thiết bị kết nối Socket:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Thiết bị ngắt kết nối:", socket.id);
  });
});

// 🟢 5. Quan trọng: Dùng server.listen (thay vì app.listen)
server.listen(PORT, () => {
  console.log(`🚀 VuaQuiz.Com Backend & Socket.io running at: http://localhost:${PORT}`);
});
