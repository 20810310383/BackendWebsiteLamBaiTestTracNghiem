const mongoose = require("mongoose");

const baiGiangDaMuaSchema = new mongoose.Schema({
  id_hoc_sinh: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'NguoiDung', 
    required: true 
  },
  id_bai_giang: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'BaiGiang', 
    required: true 
  },
  id_giao_vien: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'NguoiDung', 
    required: true 
  },
  id_lop_hoc: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'LopHoc', 
    required: true 
  },
  so_tien_da_thanh_toan: { 
    type: Number, 
    required: true 
  },
  ngay_mua: { 
    type: Date, 
    default: Date.now 
  },
  trang_thai: { 
    type: String, 
    enum: ['da_mua', 'dang_hoc', 'da_hoan_thanh'], 
    default: 'da_mua' 
  }
});

// Index để tránh trùng lặp
baiGiangDaMuaSchema.index({ id_hoc_sinh: 1, id_bai_giang: 1 }, { unique: true });

module.exports = mongoose.model('BaiGiangDaMua', baiGiangDaMuaSchema);
