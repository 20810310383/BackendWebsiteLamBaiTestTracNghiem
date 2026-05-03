const mongoose = require("mongoose");
const BaiGiangDaMua = require("../../models/BaiGiangDaMua");
const KetQuaBaiThi = require("../../models/KetQuaBaiThi");
const BaiGiang = require("../../models/BaiGiang");
const NguoiDung = require("../../models/NguoiDung");
const LopHoc = require("../../models/LopHoc");

/**
 * ================================
 * 1. MUA BÀI GIẢNG
 * ================================
 */

// Học sinh mua bài giảng
exports.muaBaiGiang = async (req, res) => {
  try {
    const id_hoc_sinh = req.user.id; // Lấy từ middleware auth
    const { id_bai_giang } = req.body;

    // 1. Kiểm tra bài giảng tồn tại
    const baiGiang = await BaiGiang.findById(id_bai_giang).populate('id_lop_hoc');
    if (!baiGiang) {
      return res.status(404).json({ success: false, message: "Bài giảng không tồn tại" });
    }

    // 2. Kiểm tra đã mua chưa
    const daMua = await BaiGiangDaMua.findOne({
      id_hoc_sinh,
      id_bai_giang
    });

    if (daMua) {
      return res.status(400).json({ 
        success: false, 
        message: "Bạn đã mua bài giảng này rồi" 
      });
    }

    // 3. Kiểm tra số dư
    const hocSinh = await NguoiDung.findById(id_hoc_sinh);
    if (hocSinh.soDu < baiGiang.giaBaiGiang) {
      return res.status(400).json({ 
        success: false, 
        message: "Số dư không đủ để mua bài giảng này",
        soDuHienTai: hocSinh.soDu,
        giaCanThanhToan: baiGiang.giaBaiGiang
      });
    }

    // 4. Trừ tiền và lưu vào lịch sử mua
    await NguoiDung.findByIdAndUpdate(id_hoc_sinh, {
      $inc: { soDu: -baiGiang.giaBaiGiang }
    });

    // 5. Lưu vào danh sách đã mua
    const baiGiangDaMua = new BaiGiangDaMua({
      id_hoc_sinh,
      id_bai_giang,
      id_giao_vien: baiGiang.id_lop_hoc.id_giaovien,
      id_lop_hoc: baiGiang.id_lop_hoc._id,
      so_tien_da_thanh_toan: baiGiang.giaBaiGiang
    });

    await baiGiangDaMua.save();

    res.status(200).json({
      success: true,
      message: "Mua bài giảng thành công",
      data: {
        baiGiangDaMua,
        soDuConLai: hocSinh.soDu - baiGiang.giaBaiGiang
      }
    });

  } catch (error) {
    console.error("Lỗi mua bài giảng:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Lấy danh sách bài giảng đã mua của học sinh (có phân trang và tìm kiếm)
exports.getDanhSachDaMua = async (req, res) => {
  try {
    const id_hoc_sinh = req.user.id;
    const { page = 1, limit = 10, search = "" } = req.query;

    // Build query
    const query = { id_hoc_sinh };

    // Get total count
    const total = await BaiGiangDaMua.countDocuments(query);

    // Get paginated data with search
    const danhSach = await BaiGiangDaMua.find(query)
      .populate({
        path: 'id_bai_giang',
        select: 'ten_bai_giang anhDaiDien giaBaiGiang thoi_gian_lam_bai danhSachCauHoi',
        populate: {
          path: 'id_lop_hoc',
          select: 'ten_lop'
        }
      })
      .sort({ ngay_mua: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Filter by search in memory (or use $regex in MongoDB)
    let filteredData = danhSach;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = danhSach.filter(item => {
        const tenBaiGiang = item.id_bai_giang?.ten_bai_giang?.toLowerCase() || "";
        const tenLop = item.id_bai_giang?.id_lop_hoc?.ten_lop?.toLowerCase() || "";
        return tenBaiGiang.includes(searchLower) || tenLop.includes(searchLower);
      });
    }

    res.status(200).json({
      success: true,
      data: {
        items: filteredData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error("Lỗi lấy danh sách đã mua:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * ================================
 * 2. LÀM BÀI THI
 * ================================
 */

// Lấy thông tin bài thi (không có đáp án đúng)
exports.getBaiThi = async (req, res) => {
  try {
    const id_hoc_sinh = req.user.id;
    const { id_bai_giang } = req.params;

    // 1. Kiểm tra đã mua chưa
    const daMua = await BaiGiangDaMua.findOne({
      id_hoc_sinh,
      id_bai_giang
    });

    if (!daMua) {
      return res.status(403).json({ 
        success: false, 
        message: "Bạn chưa mua bài giảng này" 
      });
    }

    // 2. Lấy thông tin bài giảng
    const baiGiang = await BaiGiang.findById(id_bai_giang)
      .populate('id_lop_hoc', 'ten_lop')
      .select('ten_bai_giang noi_dung_bai_hoc thoi_gian_lam_bai danhSachCauHoi');

    if (!baiGiang) {
      return res.status(404).json({ success: false, message: "Bài giảng không tồn tại" });
    }

    // 3. Lấy số lần thi
    const soLanThi = await KetQuaBaiThi.countDocuments({
      id_hoc_sinh,
      id_bai_giang
    }) + 1;

    // 4. Lấy điểm cao nhất
    const diemCaoNhat = await KetQuaBaiThi.findOne({
      id_hoc_sinh,
      id_bai_giang
    }).sort({ diem: -1 });

    // 5. Trả về câu hỏi (KHÔNG có đáp án đúng)
    const cauHoiThi = baiGiang.danhSachCauHoi.map((cauHoi, index) => ({
      id: cauHoi._id,
      stt: index + 1,
      noiDungCauHoi: cauHoi.noiDungCauHoi,
      cacDapAn: cauHoi.cacDapAn.map((dapAn, idx) => ({
        label: String.fromCharCode(65 + idx), // A, B, C, D
        noiDung: dapAn.noiDungDapAn
      }))
    }));

    res.status(200).json({
      success: true,
      data: {
        baiGiang: {
          _id: baiGiang._id,
          ten_bai_giang: baiGiang.ten_bai_giang,
          thoi_gian_lam_bai: baiGiang.thoi_gian_lam_bai,
          ten_lop: baiGiang.id_lop_hoc?.ten_lop,
          noi_dung_bai_hoc: baiGiang.noi_dung_bai_hoc,
        },
        cauHoi: cauHoiThi,
        tongSoCau: cauHoiThi.length,
        soLanThi,
        diemCaoNhat: diemCaoNhat?.diem || null
      }
    });

  } catch (error) {
    console.error("Lỗi lấy bài thi:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Nộp bài thi
exports.nopBaiThi = async (req, res) => {
  try {
    const id_hoc_sinh = req.user.id;
    const { id_bai_giang, dapAnDaChon, thoi_gian_lam_bai } = req.body;

    // 1. Kiểm tra đã mua chưa
    const daMua = await BaiGiangDaMua.findOne({
      id_hoc_sinh,
      id_bai_giang
    });

    if (!daMua) {
      return res.status(403).json({ 
        success: false, 
        message: "Bạn chưa mua bài giảng này" 
      });
    }

    // 2. Lấy bài giảng
    const baiGiang = await BaiGiang.findById(id_bai_giang)
      .populate('id_lop_hoc');

    if (!baiGiang) {
      return res.status(404).json({ success: false, message: "Bài giảng không tồn tại" });
    }

    // 3. Lấy số lần thi
    const soLanThi = await KetQuaBaiThi.countDocuments({
      id_hoc_sinh,
      id_bai_giang
    }) + 1;

    // 4. Chấm điểm
    let soCauDung = 0;
    const chiTiet = [];

    baiGiang.danhSachCauHoi.forEach((cauHoi, index) => {
      // Tìm đáp án đúng (chỉ số)
      const dapAnDungIndex = cauHoi.cacDapAn.findIndex(a => a.laDapAnDung);
      const dapAnDungLabel = String.fromCharCode(65 + dapAnDungIndex); // A, B, C, D
      
      // Đáp án học sinh đã chọn
      const dapAnChonLabel = dapAnDaChon[index]; // "A", "B", "C", "D" hoặc null

      const dungSai = dapAnChonLabel === dapAnDungLabel;
      if (dungSai) soCauDung++;

      chiTiet.push({
        id_cau_hoi: cauHoi._id,
        dap_an_chon: dapAnChonLabel,
        dap_an_dung: dapAnDungLabel,
        dung_sai: dungSai
      });
    });

    // Tính điểm (thang 10)
    const diem = (soCauDung / baiGiang.danhSachCauHoi.length * 10).toFixed(2);

    // 5. Lưu kết quả
    const ketQua = new KetQuaBaiThi({
      id_hoc_sinh,
      id_bai_giang,
      id_giao_vien: baiGiang.id_lop_hoc?.id_giaovien,
      id_lop_hoc: baiGiang.id_lop_hoc?._id,
      lan_thi: soLanThi,
      thoi_gian_lam_bai,
      so_cau_dung: soCauDung,
      tong_so_cau: baiGiang.danhSachCauHoi.length,
      diem: parseFloat(diem),
      chi_tiet_dap_an: chiTiet
    });

    await ketQua.save();

    // 6. Cập nhật trạng thái đã mua (điểm >= 8 là hoàn thành)
    const diemSo = parseFloat(diem);
    await BaiGiangDaMua.findOneAndUpdate(
      { id_hoc_sinh, id_bai_giang },
      { trang_thai: diemSo >= 8 ? 'da_hoan_thanh' : 'dang_hoc' }
    );

    res.status(200).json({
      success: true,
      message: "Nộp bài thành công",
      data: {
        lanThi: soLanThi,
        soCauDung,
        tongSoCau: baiGiang.danhSachCauHoi.length,
        diem: parseFloat(diem),
        chiTiet
      }
    });

  } catch (error) {
    console.error("Lỗi nộp bài thi:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Xem lại đáp án
exports.xemDapAn = async (req, res) => {
  try {
    const id_hoc_sinh = req.user.id;
    const { id_bai_giang } = req.params;
    const { lan_thi } = req.query;

    // Tạo query
    const query = { id_hoc_sinh, id_bai_giang };
    
    // Nếu có lan_thi thì tìm đúng lần đó
    if (lan_thi) {
      query.lan_thi = parseInt(lan_thi);
    }

    // Lấy kết quả thi (mới nhất nếu không có lan_thi)
    const ketQua = await KetQuaBaiThi.findOne(query)
      .sort(lan_thi ? { lan_thi: -1 } : { lan_thi: -1 })
      .populate('id_bai_giang');

    if (!ketQua) {
      return res.status(404).json({ success: false, message: "Chưa có kết quả thi" });
    }

    // Trả về đáp án chi tiết
    const dapAnChiTiet = ketQua.id_bai_giang.danhSachCauHoi.map((cauHoi, index) => {
      const ketQuaCauHoi = ketQua.chi_tiet_dap_an[index];
      const dapAnDungIndex = cauHoi.cacDapAn.findIndex(a => a.laDapAnDung);

      return {
        stt: index + 1,
        noiDungCauHoi: cauHoi.noiDungCauHoi,
        giaiThich: cauHoi.giaiThich,
        cacDapAn: cauHoi.cacDapAn.map((dapAn, idx) => ({
          label: String.fromCharCode(65 + idx),
          noiDung: dapAn.noiDungDapAn,
          laDapAnDung: dapAn.laDapAnDung,
          daChon: ketQuaCauHoi?.dap_an_chon === String.fromCharCode(65 + idx)
        }))
      };
    });

    // Cập nhật trạng thái
    await KetQuaBaiThi.findByIdAndUpdate(ketQua._id, { trang_thai: 'da_xem_dap_an' });

    res.status(200).json({
      success: true,
      data: {
        ketQua: {
          idBaiGiang: ketQua.id_bai_giang._id,
          tenBaiGiang: ketQua.id_bai_giang.ten_bai_giang,
          lanThi: ketQua.lan_thi,
          diem: ketQua.diem,
          soCauDung: ketQua.so_cau_dung,
          tongSoCau: ketQua.tong_so_cau,
          ngayLamBai: ketQua.ngay_lam_bai
        },
        dapAnChiTiet
      }
    });

  } catch (error) {
    console.error("Lỗi xem đáp án:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

/**
 * ================================
 * 3. THỐNG KÊ CHO GIÁO VIÊN
 * ================================
 */

// Thống kê điểm của tất cả học sinh trong lớp
exports.thongKeDiemTheoLop = async (req, res) => {
  try {
    const id_giao_vien = req.user.id;
    const { id_lop_hoc } = req.params;

    // 1. Kiểm tra lớp thuộc giáo viên
    const lopHoc = await LopHoc.findOne({
      _id: id_lop_hoc,
      id_giaovien: id_giao_vien
    });

    if (!lopHoc) {
      return res.status(403).json({ 
        success: false, 
        message: "Bạn không có quyền xem thống kê lớp này" 
      });
    }

    // 2. Lấy danh sách học sinh đã mua bài giảng trong lớp
    const hocVienLop = await BaiGiangDaMua.find({ id_lop_hoc })
      .populate('id_hoc_sinh', 'ho_ten ma_so')
      .populate('id_bai_giang', 'ten_bai_giang danhSachCauHoi');

    // 3. Thống kê theo học sinh
    const thongKeHocSinh = {};
    
    for (const item of hocVienLop) {
      const idHocSinh = item.id_hoc_sinh._id.toString();
      
      if (!thongKeHocSinh[idHocSinh]) {
        thongKeHocSinh[idHocSinh] = {
          hocSinh: {
            _id: item.id_hoc_sinh._id,
            ho_ten: item.id_hoc_sinh.ho_ten,
            ma_so: item.id_hoc_sinh.ma_so
          },
          cacBaiThi: [],
          tongSoLanThi: 0,
          diemTrungBinh: 0,
          diemCaoNhat: 0,
          soBaiDaThi: 0
        };
      }

      // Lấy kết quả thi của học sinh cho bài giảng này
      const ketQuaList = await KetQuaBaiThi.find({
        id_hoc_sinh: idHocSinh,
        id_bai_giang: item.id_bai_giang._id
      }).sort({ diem: -1 });

      if (ketQuaList.length > 0) {
        thongKeHocSinh[idHocSinh].cacBaiThi.push({
          baiGiang: item.id_bai_giang.ten_bai_giang,
          id_bai_giang: item.id_bai_giang._id,
          tongSoCau: ketQuaList[0].tong_so_cau,
          diemCaoNhat: ketQuaList[0].diem,
          tongSoLanThi: ketQuaList.length,
          lanThiMoiNhat: ketQuaList[ketQuaList.length - 1].lan_thi
        });
        thongKeHocSinh[idHocSinh].soBaiDaThi++;
        thongKeHocSinh[idHocSinh].tongSoLanThi += ketQuaList.length;
      }
    }

    // Tính điểm trung bình
    const danhSachHocSinh = Object.values(thongKeHocSinh);
    
    danhSachHocSinh.forEach(hs => {
      if (hs.cacBaiThi.length > 0) {
        const diemTong = hs.cacBaiThi.reduce((sum, bai) => sum + bai.diemCaoNhat, 0);
        hs.diemTrungBinh = (diemTong / hs.cacBaiThi.length).toFixed(2);
        hs.diemCaoNhat = Math.max(...hs.cacBaiThi.map(b => b.diemCaoNhat));
      }
    });

    // 4. Sắp xếp theo điểm giảm dần
    danhSachHocSinh.sort((a, b) => b.diemTrungBinh - a.diemTrungBinh);

    res.status(200).json({
      success: true,
      data: {
        lopHoc: {
          _id: lopHoc._id,
          ten_lop: lopHoc.ten_lop,
          siSo: lopHoc.danh_sach_hoc_vien?.length || 0,
          soHocSinhDaMua: danhSachHocSinh.length
        },
        danhSachHocSinh
      }
    });

  } catch (error) {
    console.error("Lỗi thống kê điểm:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Thống kê chi tiết một học sinh
exports.thongKeDiemHocSinh = async (req, res) => {
  try {
    const id_giao_vien = req.user.id;
    const { id_hoc_sinh } = req.params;

    // Lấy thông tin học sinh
    const hocSinh = await NguoiDung.findById(id_hoc_sinh);
    if (!hocSinh) {
      return res.status(404).json({ success: false, message: "Học sinh không tồn tại" });
    }

    // Lấy tất cả kết quả thi
    const ketQuaList = await KetQuaBaiThi.find({ id_hoc_sinh })
      .populate('id_bai_giang', 'ten_bai_giang id_lop_hoc')
      .sort({ ngay_lam_bai: -1 });

    // Lọc chỉ lấy bài giảng thuộc lớp của giáo viên
    const lopCuaGV = await LopHoc.find({ id_giaovien: id_giao_vien });
    const lopIds = lopCuaGV.map(l => l._id.toString());

    const ketQuaTheoLop = {};
    
    ketQuaList.forEach(kq => {
      const lopId = kq.id_bai_giang?.id_lop_hoc?.toString();
      if (lopIds.includes(lopId)) {
        if (!ketQuaTheoLop[lopId]) {
          ketQuaTheoLop[lopId] = {
            ten_lop: lopCuaGV.find(l => l._id.toString() === lopId)?.ten_lop,
            cacBaiThi: []
          };
        }
        
        // Nhóm theo bài giảng
        const baiGiangId = kq.id_bai_giang._id.toString();
        const baiExist = ketQuaTheoLop[lopId].cacBaiThi.find(
          b => b.id_bai_giang.toString() === baiGiangId
        );
        
        if (!baiExist) {
          ketQuaTheoLop[lopId].cacBaiThi.push({
            id_bai_giang: kq.id_bai_giang._id,
            ten_bai_giang: kq.id_bai_giang.ten_bai_giang,
            soCau: kq.tong_so_cau,
            diemCaoNhat: kq.diem,
            soLanThi: 1,
            chiTietLanThi: [{
              lan: kq.lan_thi,
              diem: kq.diem,
              soCauDung: kq.so_cau_dung,
              ngayThi: kq.ngay_lam_bai
            }]
          });
        } else {
          baiExist.soLanThi++;
          baiExist.diemCaoNhat = Math.max(baiExist.diemCaoNhat, kq.diem);
          baiExist.chiTietLanThi.push({
            lan: kq.lan_thi,
            diem: kq.diem,
            soCauDung: kq.so_cau_dung,
            ngayThi: kq.ngay_lam_bai
          });
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        hocSinh: {
          _id: hocSinh._id,
          ho_ten: hocSinh.ho_ten,
          ma_so: hocSinh.ma_so
        },
        ketQuaTheoLop: Object.values(ketQuaTheoLop)
      }
    });

  } catch (error) {
    console.error("Lỗi thống kê học sinh:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Thống kê tất cả các bài thi của một bài giảng
exports.thongKeDiemBaiGiang = async (req, res) => {
  try {
    const id_giao_vien = req.user.id;
    const { id_bai_giang } = req.params;

    // Kiểm tra bài giảng thuộc lớp của giáo viên
    const baiGiang = await BaiGiang.findById(id_bai_giang)
      .populate('id_lop_hoc');

    if (!baiGiang) {
      return res.status(404).json({ success: false, message: "Bài giảng không tồn tại" });
    }

    if (baiGiang.id_lop_hoc?.id_giaovien.toString() !== id_giao_vien) {
      return res.status(403).json({ 
        success: false, 
        message: "Bạn không có quyền xem thống kê bài giảng này" 
      });
    }

    // Lấy tất cả kết quả thi
    const ketQuaList = await KetQuaBaiThi.find({ id_bai_giang })
      .populate('id_hoc_sinh', 'ho_ten ma_so')
      .sort({ diem: -1 });

    // Thống kê
    const diemList = ketQuaList.map(kq => kq.diem);
    const diemCaoNhat = Math.max(...diemList);
    const diemThapNhat = Math.min(...diemList);
    const diemTrungBinh = (diemList.reduce((a, b) => a + b, 0) / diemList.length).toFixed(2);

    // Đếm theo khoảng điểm
    const phanPhoiDiem = {
      '0-2': 0,
      '2-4': 0,
      '4-6': 0,
      '6-8': 0,
      '8-10': 0
    };

    ketQuaList.forEach(kq => {
      if (kq.diem < 2) phanPhoiDiem['0-2']++;
      else if (kq.diem < 4) phanPhoiDiem['2-4']++;
      else if (kq.diem < 6) phanPhoiDiem['4-6']++;
      else if (kq.diem < 8) phanPhoiDiem['6-8']++;
      else phanPhoiDiem['8-10']++;
    });

    // Top 5 học sinh
    const topHocSinh = ketQuaList.slice(0, 5).map(kq => ({
      ho_ten: kq.id_hoc_sinh.ho_ten,
      ma_so: kq.id_hoc_sinh.ma_so,
      diem: kq.diem,
      lan_thi: kq.lan_thi
    }));

    res.status(200).json({
      success: true,
      data: {
        baiGiang: {
          _id: baiGiang._id,
          ten_bai_giang: baiGiang.ten_bai_giang,
          ten_lop: baiGiang.id_lop_hoc?.ten_lop
        },
        tongSoLanThi: ketQuaList.length,
        soHocSinh: new Set(ketQuaList.map(kq => kq.id_hoc_sinh._id.toString())).size,
        thongKe: {
          diemCaoNhat,
          diemThapNhat,
          diemTrungBinh,
          phanPhoiDiem
        },
        topHocSinh,
        chiTiet: ketQuaList.slice(0, 20).map(kq => ({
          ho_ten: kq.id_hoc_sinh.ho_ten,
          ma_so: kq.id_hoc_sinh.ma_so,
          lan_thi: kq.lan_thi,
          diem: kq.diem,
          so_cau_dung: kq.so_cau_dung,
          tong_so_cau: kq.tong_so_cau,
          ngay_lam_bai: kq.ngay_lam_bai
        }))
      }
    });

  } catch (error) {
    console.error("Lỗi thống kê bài giảng:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Lấy lịch sử thi của học sinh (có phân trang và tìm kiếm)
exports.getLichSuThi = async (req, res) => {
  try {
    const id_hoc_sinh = req.user.id;
    const { page = 1, limit = 10, search = "" } = req.query;

    // Build query
    const query = { id_hoc_sinh };

    // Get total count
    const total = await KetQuaBaiThi.countDocuments(query);

    // Get paginated data
    let danhSach = await KetQuaBaiThi.find(query)
      .populate('id_bai_giang', 'ten_bai_giang anhDaiDien')
      .sort({ ngay_lam_bai: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      danhSach = danhSach.filter(item => {
        const tenBaiGiang = item.id_bai_giang?.ten_bai_giang?.toLowerCase() || "";
        return tenBaiGiang.includes(searchLower);
      });
    }

    res.status(200).json({
      success: true,
      data: {
        items: danhSach,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error("Lỗi lấy lịch sử thi:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Lấy tiến độ học tập của học sinh
exports.getTienDoHocTap = async (req, res) => {
  try {
    const id_hoc_sinh = req.user.id;

    // 1. Đếm tổng số bài đã mua
    const tongBaiDaMua = await BaiGiangDaMua.countDocuments({ id_hoc_sinh });

    // 2. Đếm số bài đã hoàn thành (trang_thai = 'da_hoan_thanh')
    const baiDaHoanThanh = await BaiGiangDaMua.countDocuments({
      id_hoc_sinh,
      trang_thai: 'da_hoan_thanh'
    });

    // 3. Đếm tổng số lần thi đã làm
    const soLanThi = await KetQuaBaiThi.countDocuments({ id_hoc_sinh });

    // 4. Tính điểm trung bình (nếu có bài thi)
    const avgDiem = await KetQuaBaiThi.aggregate([
      { $match: { id_hoc_sinh: new mongoose.Types.ObjectId(id_hoc_sinh) } },
      { $group: { _id: null, diemTrungBinh: { $avg: "$diem" } } }
    ]);

    // 5. Tính phần trăm hoàn thành
    const phanTramHoanThanh = tongBaiDaMua > 0 
      ? Math.round((baiDaHoanThanh / tongBaiDaMua) * 100) 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        tongBaiDaMua,
        baiDaHoanThanh,
        baiDangHoc: tongBaiDaMua - baiDaHoanThanh,
        soLanThi,
        diemTrungBinh: avgDiem[0]?.diemTrungBinh 
          ? Math.round(avgDiem[0].diemTrungBinh * 10) / 10 
          : 0,
        phanTramHoanThanh
      }
    });

  } catch (error) {
    console.error("Lỗi lấy tiến độ học tập:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
