const express = require("express");
const router = express.Router();
const lopHocController = require("../controllers/lophoc/lopHocController");
const { protect } = require("../middlewares/authMiddleware");
const isAdmin = require("../middlewares/adminMiddleware");
const {  checkRole } = require("../middlewares/authMiddlewareFull");
// 🔒 Tất cả các route bên dưới đều yêu cầu đăng nhập
// router.use(protect);

/* ──────────────────────────────────────────────────────────────────
   ROUTES DÀNH CHO GIÁO VIÊN & ADMIN
   ────────────────────────────────────────────────────────────────── */
// Phê duyệt hoặc Từ chối học viên xin vào lớp
router.put(
  "/approve-student", 
  protect,
  checkRole(['admin', 'giaovien']), 
  lopHocController.approveStudent
);

// Tạo lớp học mới (Tự động sinh mã lớp ngẫu nhiên)
router.post(
  "/", 
  protect,
  checkRole(['admin', 'giaovien']), 
  lopHocController.createClass
);

// Lấy chi tiết 1 lớp học (Hiện đầy đủ thông tin + mã lớp + danh sách học viên)
router.get(
  "/:id", 
  protect,
  lopHocController.getClassById
);

// Cập nhật thông tin lớp (Chỉ giáo viên tạo lớp hoặc admin mới được sửa)
router.put(
  "/:id", 
  protect,
  checkRole(['admin', 'giaovien']), 
  lopHocController.updateClass
);

// Xóa lớp học
router.delete(
  "/:id", 
  protect,
  checkRole(['admin', 'giaovien']), 
  lopHocController.deleteClass
);



// Route đổi mã lớp cho lớp đã có
router.put(
  "/:id/refresh-code", 
  protect,
  checkRole(['admin', 'giaovien']), 
  lopHocController.refreshClassCode
);

/* ──────────────────────────────────────────────────────────────────
   ROUTES DÀNH CHO HỌC VIÊN & CHUNG
   ────────────────────────────────────────────────────────────────── */

// Lấy tất cả lớp học (Đã ẩn ma_lop_random để bảo mật)
router.get(
  "/", 
  protect,
  lopHocController.getAllClasses
);

// Học viên gửi yêu cầu tham gia lớp bằng cách nhập mã
router.post(
  "/join-by-code", 
  protect,
  checkRole(['hocsinh']), 
  lopHocController.joinClassByCode
);

module.exports = router;