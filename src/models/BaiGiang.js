const mongoose = require("mongoose");
const crypto = require("crypto");

const cauHoiSchema = new mongoose.Schema({
  noiDungCauHoi: { type: String, trim: true },

  // Hỗ trợ chọn nhiều đáp án đúng
  cacDapAn: [{
    noiDungDapAn: { type: String, required: true },
    laDapAnDung: { type: Boolean, default: false }
  }],
  giaiThich: { type: String, trim: true }, 
});

const BaiGiangSchema = new mongoose.Schema({
    maBaiGiang: { 
        type: String, 
        unique: true, 
        uppercase: true, 
        default: () => crypto.randomBytes(3).toString("hex").toUpperCase() 
    },
    id_lop_hoc: { type: mongoose.Schema.Types.ObjectId, ref: 'LopHoc', required: true },
    ten_bai_giang: { type: String, required: true },
    anhDaiDien: { type: String },
    gioiThieu: { type: String },
    
    // monHoc: { type: mongoose.Schema.Types.ObjectId, ref: 'MonHoc' },
    // Nội dung học tập
    noi_dung_bai_hoc: { type: String, default: "" },

    // Hệ thống câu hỏi trắc nghiệm
    danhSachCauHoi: [cauHoiSchema],

    thoi_gian_lam_bai: { type: Number, default: 15 }, // Tính theo phút
    giaBaiGiang: { type: Number, default: 0 }, // Giá bán bài giảng (nếu có hệ thống thanh toán)
    ngay_tao: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BaiGiang', BaiGiangSchema);