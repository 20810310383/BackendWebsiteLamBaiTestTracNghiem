const mongoose = require("mongoose");

const nguoiDungSchema = new mongoose.Schema({
  ma_so: { type: String, required: true, unique: true, trim: true }, // MSSV hoặc Mã GV
  ho_ten: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  so_dien_thoai: { type: String, required: true },
  mat_khau: { type: String, required: true }, // Nên lưu hash (bcrypt)
  vai_tro: { 
    type: String, 
    enum: ['admin', 'giaovien', 'hocsinh'], 
    default: 'hocsinh' 
  },
  ten_lop_sinh_hoat: { type: String }, // Ví dụ: IT01, Marketing02
  anh_dai_dien: { type: String, default: "" },
  trang_thai_hoat_dong: { type: Boolean, default: true },
  ngay_tao: { type: Date, default: Date.now },
  
  // Xác thực 
  maOTP: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  currentToken: { type: String }
}, { timestamps: true });

module.exports = mongoose.model("NguoiDung", nguoiDungSchema);