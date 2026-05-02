const mongoose = require("mongoose");
const crypto = require("crypto");

const LopHocSchema =  new mongoose.Schema({
  maKey: {
    type: String,
    unique: true,
    uppercase: true,
    default: () => crypto.randomBytes(3).toString("hex").toUpperCase(),
  },
  ten_lop: { type: String, required: true },
  anh_lop: { type: String,  },
  ma_lop_random: { type: String, unique: true, required: true }, // Mã để SV nhập
  // id_mon_hoc: { type: mongoose.Schema.Types.ObjectId, ref: 'MonHoc', required: true },
  id_giaovien: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
  
  // Quản lý học viên tham gia và phê duyệt
  danh_sach_hoc_vien: [{
    id_hoc_vien: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung' },
    trang_thai_phe_duyet: { 
      type: String, 
      enum: ['cho_phe_duyet', 'da_tham_gia', 'bi_tu_choi'], 
      default: 'cho_phe_duyet' 
    },
    ngay_vao_lop: { type: Date, default: Date.now }
  }],
  
  mo_ta_lop: { type: String },
  si_so_toi_da: { type: Number, default: 100 },
  ngay_bat_dau: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LopHoc', LopHocSchema);