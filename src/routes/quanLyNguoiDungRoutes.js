const express = require("express");
const router = express.Router();
const QuanLyNguoiDungController = require("../controllers/admin/QuanLyNguoiDungController");
const {  checkRole } = require("../middlewares/authMiddlewareFull");
const { protect } = require("../middlewares/authMiddleware");


// Routes
router.get("/", protect, checkRole(['admin']), QuanLyNguoiDungController.getAllUsers);
router.get("/stats", protect, checkRole(['admin']), QuanLyNguoiDungController.getStats);
router.get("/:id", protect, checkRole(['admin']), QuanLyNguoiDungController.getUserById);
router.post("/", protect, checkRole(['admin']), QuanLyNguoiDungController.createUser);
router.put("/:id", protect, checkRole(['admin']), QuanLyNguoiDungController.updateUser);
router.put("/:id/doi-mat-khau", protect, checkRole(['admin']), QuanLyNguoiDungController.changePassword);
router.put("/:id/phan-quyen", protect, checkRole(['admin']), QuanLyNguoiDungController.changeRole);
router.put("/:id/toggle-status", protect, checkRole(['admin']), QuanLyNguoiDungController.toggleStatus);
router.delete("/:id", protect, checkRole(['admin']), QuanLyNguoiDungController.deleteUser);

module.exports = router;
