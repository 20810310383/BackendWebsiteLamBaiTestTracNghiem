const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { registerTK, loginTK, logoutTK, getMeTK, doiMatKhau, capNhatThongTin, xacThucOTPAndRegister, quenMatKhau, } = require("../controllers/auth/authController");

router.post("/register", registerTK);
router.post("/login", loginTK);
router.post("/logout", logoutTK);
router.get("/me", protect, getMeTK);

router.post("/verify-register", xacThucOTPAndRegister); // Bước 2: Check OTP & Save User

// ✅ Đổi mật khẩu
router.put("/doi-mat-khau", protect, doiMatKhau);

// ✅ Cập nhật thông tin
router.put("/cap-nhat-thong-tin", protect, capNhatThongTin);

router.post("/forgot-password", quenMatKhau);

module.exports = router;
