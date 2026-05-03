const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

// Cấu hình multer cho upload Word
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.docx') {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file .docx"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const baiGiangController = require("../controllers/baigiang/BaiGiangController");
const { protect } = require("../middlewares/authMiddleware");
const { checkRole } = require("../middlewares/authMiddlewareFull");

/* ──────────────────────────────────────────────────────────────────
   ROUTES CRUD CƠ BẢN
   ────────────────────────────────────────────────────────────────── */

// Tạo bài giảng mới
router.post(
  "/",
  protect,
  checkRole(['admin', 'giaovien']),
  baiGiangController.createBaiGiang
);

// Lấy tất cả bài giảng (Có phân trang, tìm kiếm, lọc)
router.get(
  "/",
  protect,
  baiGiangController.getAllBaiGiang
);

// Lấy chi tiết một bài giảng
router.get(
  "/:id",
  protect,
  baiGiangController.getBaiGiangById
);

// Cập nhật bài giảng
router.put(
  "/:id",
  protect,
  checkRole(['admin', 'giaovien']),
  baiGiangController.updateBaiGiang
);

// Xóa bài giảng
router.delete(
  "/:id",
  protect,
  checkRole(['admin', 'giaovien']),
  baiGiangController.deleteBaiGiang
);

/* ──────────────────────────────────────────────────────────────────
   ROUTES QUẢN LÝ CÂU HỎI
   ────────────────────────────────────────────────────────────────── */

// Lấy bài giảng theo lớp học
router.get(
  "/lop-hoc/:id_lop_hoc",
  protect,
  baiGiangController.getBaiGiangByLopHoc
);

// Thêm một câu hỏi vào bài giảng
router.post(
  "/:id/cau-hoi",
  protect,
  checkRole(['admin', 'giaovien']),
  baiGiangController.themCauHoi
);

// Thêm nhiều câu hỏi cùng lúc
router.post(
  "/:id/cau-hoi/nhieu",
  protect,
  checkRole(['admin', 'giaovien']),
  baiGiangController.themNhieuCauHoi
);

// Cập nhật câu hỏi trong bài giảng
router.put(
  "/:id/cau-hoi/:cauHoiId",
  protect,
  checkRole(['admin', 'giaovien']),
  baiGiangController.updateCauHoi
);

// Xóa câu hỏi khỏi bài giảng
router.delete(
  "/:id/cau-hoi/:cauHoiId",
  protect,
  checkRole(['admin', 'giaovien']),
  baiGiangController.xoaCauHoi
);

// Sắp xếp lại thứ tự câu hỏi
router.put(
  "/:id/cau-hoi/sap-xep",
  protect,
  checkRole(['admin', 'giaovien']),
  baiGiangController.sapXepCauHoi
);

// Import câu hỏi từ file Word
router.post(
  "/:id/cau-hoi/import-word",
  protect,
  checkRole(['admin', 'giaovien']),
  upload.single('file'),
  baiGiangController.importCauHoiTuWord
);

/* ──────────────────────────────────────────────────────────────────
   ROUTES THỐNG KÊ
   ────────────────────────────────────────────────────────────────── */

// Lấy thống kê bài giảng (cho dashboard)
router.get(
  "/thong-ke/tong-quan",
  protect,
  checkRole(['admin', 'giaovien']),
  baiGiangController.getThongKeBaiGiang
);

module.exports = router;
