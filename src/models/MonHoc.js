const mongoose = require("mongoose");

const MonHocSchema = new Schema({
  ten_mon: { type: String, required: true, unique: true },
  hinh_anh: { type: String },
  mo_ta: { type: String },
  ma_mon_hoc: { type: String, unique: true }, // Ví dụ: CS101
  nguoi_tao: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung' },
  ngay_cap_nhat: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MonHoc', MonHocSchema);