const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");

const PORT = process.env.PORT || 6000;

// 🟢 1. Tạo HTTP Server từ Express App
const server = http.createServer(app);

// 🟢 2. Khởi tạo Socket.io gắn vào Server đó
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:2003", "https://ktquizz.vercel.app", "https://vuaquiz.com"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// 🟢 3. "Gắn" io vào app để dùng được ở mọi nơi (Controller)
app.set("socketio", io);

// 🟢 4. Lắng nghe kết nối
io.on("connection", (socket) => {
  console.log("⚡ Có thiết bị kết nối Socket:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Thiết bị ngắt kết nối:", socket.id);
  });
});

// 🟢 5. Quan trọng: Dùng server.listen (thay vì app.listen)
server.listen(PORT, () => {
  console.log(`🚀 VuaQuiz.Com Backend & Socket.io running at: http://localhost:${PORT}`);
});