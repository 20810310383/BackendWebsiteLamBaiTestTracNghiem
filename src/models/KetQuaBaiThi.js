const mongoose = require("mongoose");

const ketQuaBaiThiSchema = new mongoose.Schema({
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
    ref: 'NguoiDung' 
  },
  id_lop_hoc: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'LopHoc' 
  },
  
  // Thông tin bài thi
  lan_thi: { type: Number, default: 1 },
  thoi_gian_lam_bai: { type: Number }, // Thời gian làm bài thực tế (giây)
  ngay_lam_bai: { type: Date, default: Date.now },
  
  // Kết quả
  so_cau_dung: { type: Number, default: 0 },
  tong_so_cau: { type: Number, required: true },
  diem: { type: Number, default: 0 }, // Điểm tối đa 10
  
  // Chi tiết đáp án
  chi_tiet_dap_an: [{
    id_cau_hoi: { type: mongoose.Schema.Types.ObjectId },
    dap_an_chon: { type: String }, // "A" | "B" | "C" | "D" | null
    dap_an_dung: { type: String }, // "A" | "B" | "C" | "D"
    dung_sai: { type: Boolean }
  }],
  
  // Trạng thái
  trang_thai: { 
    type: String, 
    enum: ['dang_lam', 'da_nop_bai', 'da_xem_dap_an'], 
    default: 'da_nop_bai' 
  }
});

// Index cho việc thống kê
ketQuaBaiThiSchema.index({ id_hoc_sinh: 1, id_bai_giang: 1 });
ketQuaBaiThiSchema.index({ id_giao_vien: 1, id_bai_giang: 1 });
ketQuaBaiThiSchema.index({ id_lop_hoc: 1, id_hoc_sinh: 1 });

module.exports = mongoose.model('KetQuaBaiThi', ketQuaBaiThiSchema);
