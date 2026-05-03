const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const multer = require("multer");

const viewEngine = require("./config/viewEngine");
const connectDB = require("./config/connectDB");

// ================= ROUTES =================
const uploadImageRoute = require("./routes/uploadImageRoute");
const uploadVideoRoute = require("./routes/uploadVideoRoute");
const uploadAudioRoute = require("./routes/uploadAudioRoute");
const uploadDocumentRoute = require("./routes/uploadDocumentRoute");
const authRouter = require("./routes/authRouter");
const nguoiDungRoutes = require("./routes/nguoiDungRoutes");
const lopHocRoutes = require("./routes/lopHocRoutes");
const baiGiangRoutes = require("./routes/baiGiangRoutes");
const baiGiangThuongMaiRoutes = require("./routes/baiGiangThuongMaiRoutes");
const lichSuThiRoutes = require("./routes/lichSuThiRoutes");
const quanLyNguoiDungRoutes = require("./routes/quanLyNguoiDungRoutes");

// const crawlRoutes = require("./routes/crawlRoutes");

// ==========================================

require("dotenv").config();

const app = express();

// ================= DB =================
connectDB();

// ================= CORS =================
const allowedOrigins = [
  "http://localhost:2004",
  'chrome-extension://gimjcdniohfjmmbhhdbcogfkfkbogfmn'
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    exposedHeaders: ['Content-Disposition'], // Đảm bảo header này được phép
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "upload-type"],
  })
);

app.options("/*", cors());
app.set("trust proxy", true);

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(bodyParser.urlencoded({ limit: "2mb", extended: true }));
app.use(cookieParser());

// ================= STATIC =================
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "public", "uploads"))
);
// ================= VIEW ENGINE =================
viewEngine(app);

// ================= ROUTES MAP =================
const routes = [
  { path: "/api/upload", router: uploadImageRoute },
  { path: "/api/upload-video", router: uploadVideoRoute },
  { path: "/api/upload-audio", router: uploadAudioRoute },
  { path: "/api/upload-document", router: uploadDocumentRoute },
  { path: '/api/auth', router: authRouter },
  { path: '/api/nguoidung', router: nguoiDungRoutes },
  { path: '/api/lop-hoc', router: lopHocRoutes },
  { path: '/api/bai-giang', router: baiGiangRoutes },
  { path: '/api/bai-giang-thuong-mai', router: baiGiangThuongMaiRoutes },
  { path: '/api/lich-su-thi', router: lichSuThiRoutes },
  { path: '/api/admin/nguoi-dung', router: quanLyNguoiDungRoutes },
];

routes.forEach((r) => app.use(r.path, r.router));


// Log RAM mỗi 5 giây 1 lần để xem tốc độ tăng trưởng
setInterval(() => {
  const mem = process.memoryUsage();
  if (mem.rss > 800 * 1024 * 1024) { // Nếu RSS > 800MB
    console.warn('⚠️ CẢNH BÁO: RAM TĂNG QUÁ CAO!', (mem.rss / 1024 / 1024).toFixed(2), 'MB');
  }
}, 5000);

module.exports = app;
