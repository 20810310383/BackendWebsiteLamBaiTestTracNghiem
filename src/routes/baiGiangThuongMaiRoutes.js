const express = require("express");
const router = express.Router();
const BaiGiangThuongMaiController = require("../controllers/baigiang/BaiGiangThuongMaiController");
const authMiddleware = require("../middlewares/authMiddleware").protect;

/**
 * ================================
 * ROUTES CHO HỌC SINH
 * ================================
 */

// Mua bài giảng
router.post("/mua-bai-giang", authMiddleware, BaiGiangThuongMaiController.muaBaiGiang);

// Lấy danh sách bài giảng đã mua
router.get("/danh-sach-da-mua", authMiddleware, BaiGiangThuongMaiController.getDanhSachDaMua);

// Lấy thông tin bài thi (không có đáp án)
router.get("/bai-thi/:id_bai_giang", authMiddleware, BaiGiangThuongMaiController.getBaiThi);

// Nộp bài thi
router.post("/nop-bai-thi", authMiddleware, BaiGiangThuongMaiController.nopBaiThi);

// Xem đáp án
router.get("/xem-dap-an/:id_bai_giang", authMiddleware, BaiGiangThuongMaiController.xemDapAn);

// Lịch sử thi
router.get("/lich-su-thi", authMiddleware, BaiGiangThuongMaiController.getLichSuThi);

// Lấy tiến độ học tập
router.get("/tien-do-hoc-tap", authMiddleware, BaiGiangThuongMaiController.getTienDoHocTap);

/**
 * ================================
 * ROUTES CHO GIÁO VIÊN (THỐNG KÊ)
 * ================================
 */

// Thống kê điểm theo lớp
router.get("/thong-ke/lop/:id_lop_hoc", authMiddleware, BaiGiangThuongMaiController.thongKeDiemTheoLop);

// Thống kê chi tiết một học sinh
router.get("/thong-ke/hoc-sinh/:id_hoc_sinh", authMiddleware, BaiGiangThuongMaiController.thongKeDiemHocSinh);

// Thống kê một bài giảng
router.get("/thong-ke/bai-giang/:id_bai_giang", authMiddleware, BaiGiangThuongMaiController.thongKeDiemBaiGiang);

module.exports = router;
