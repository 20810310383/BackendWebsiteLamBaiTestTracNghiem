const mongoose = require("mongoose");

const LichSuLamBaiSchema = new mongoose.Schema({
  // 1. Định danh thực thể
  id_hoc_vien: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
  id_lop_hoc: { type: mongoose.Schema.Types.ObjectId, ref: 'LopHoc', required: true },
  id_bai_giang_goc: { type: mongoose.Schema.Types.ObjectId, ref: 'BaiGiang', default: null },

  // 2. SNAPSHOT: Lưu lại nội dung tại thời điểm làm bài
  // Giúp xem lại bài cũ ngay cả khi bài giảng gốc đã bị sửa hoặc xóa
  tieu_de_snapshot: { type: String, required: true },
  noi_dung_bai_hoc_snapshot: { type: String }, // Lưu nội dung soạn thảo HTML
  du_lieu_cau_hoi_snapshot: { type: Array, default: [] }, // Mảng chứa các câu hỏi + đáp án đúng gốc

  // 3. CHI TIẾT CÂU TRẢ LỜI CỦA USER
  tra_loi_cua_user: [{
    id_cau_hoi: { type: String },
    dap_an_da_chon: [{ type: Number }], // Mảng Number hỗ trợ chọn nhiều đáp án
    la_dung: { type: Boolean, default: false } // Kết quả check tại thời điểm nộp
  }],

  // 4. KẾT QUẢ & THỐNG KÊ
  thong_so_diem: {
    so_cau_dung: { type: Number, default: 0 },
    tong_so_cau: { type: Number, default: 0 },
    diem_so: { type: Number, default: 0 }, // Thang điểm 10
    thoi_gian_lam_bai_giay: { type: Number, default: 0 } // Thời gian hoàn thành thực tế
  },
  
  // 5. PHÂN LOẠI (Nếu cần dùng chung cho cả Luyện tập và Kiểm tra)
//   che_do_lam_bai: { 
//     type: String, 
//     enum: ['luyen_tap', 'kiem_tra'], 
//     default: 'luyen_tap' 
//   }
}, { 
  timestamps: true // Tự động tạo createdAt (thời gian nộp bài) và updatedAt
});

// Middleware tự động tính điểm hệ 10 trước khi lưu
LichSuLamBaiSchema.pre('save', function(next) {
  if (this.thong_so_diem.tong_so_cau > 0) {
    const rawScore = (this.thong_so_diem.so_cau_dung / this.thong_so_diem.tong_so_cau) * 10;
    this.thong_so_diem.diem_so = Math.round(rawScore * 100) / 100; // Làm tròn 2 chữ số thập phân
  }
  next();
});

module.exports = mongoose.model('LichSuLamBai', LichSuLamBaiSchema);