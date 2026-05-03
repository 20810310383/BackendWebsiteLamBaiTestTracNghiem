const express = require('express');
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const LichSuThiController = require('../controllers/baigiang/LichSuThiController');
const {  checkRole } = require("../middlewares/authMiddlewareFull");
// Áp dụng auth middleware cho tất cả routes
router.use(protect);

// Routes cho lịch sử thi - chỉ admin và giaovien
router.get('/danh-sach', 
  checkRole(['admin', 'giaovien']), 
  LichSuThiController.getLichSuThi
);

router.get('/hoc-vien/:bai_giang_id', 
  checkRole(['admin', 'giaovien']), 
  LichSuThiController.getHocVienDaThi
);

router.get('/chi-tiet/:id', 
  checkRole(['admin', 'giaovien']), 
  LichSuThiController.getChiTietBaiThi
);

router.get('/thong-ke', 
  checkRole(['admin', 'giaovien']), 
  LichSuThiController.getThongKe
);

// Filters
router.get('/filter/lop', 
  checkRole(['admin', 'giaovien']), 
  LichSuThiController.getDanhSachLopFilter
);

router.get('/filter/bai-giang', 
  checkRole(['admin', 'giaovien']), 
  LichSuThiController.getDanhSachBaiGiangFilter
);

module.exports = router;
