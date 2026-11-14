const KetQuaBaiThi = require('../../models/KetQuaBaiThi');
const NguoiDung = require('../../models/NguoiDung');
const LopHoc = require('../../models/LopHoc');
const BaiGiang = require('../../models/BaiGiang');
const mongoose = require('mongoose');

// Dashboard is scoped by the authenticated user and, for teachers, their own classes.
exports.getDashboard = async (req, res) => {
  try {
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const offset = 7 * 60 * 60 * 1000;
    const start = new Date(Math.floor((Date.now() + offset) / 86400000) * 86400000 - offset - (days - 1) * 86400000);
    const completed = { ngay_lam_bai: { $gte: start }, trang_thai: { $in: ['da_nop_bai', 'da_xem_dap_an'] } };
    const personal = { ...completed, id_hoc_sinh: new mongoose.Types.ObjectId(req.user.id) };
    const management = ['admin', 'giaovien'].includes(req.user.role);
    const classScope = { ...completed };
    if (req.user.role === 'giaovien') {
      const classes = await LopHoc.find({ id_giaovien: req.user._id }).select('_id').lean();
      classScope.id_lop_hoc = { $in: classes.map(item => item._id) };
    }
    const summarize = async (match, includeClasses) => {
      const facets = {
        summary: [{ $group: { _id: null, attempts: { $sum: 1 }, average: { $avg: '$diem' }, best: { $max: '$diem' }, students: { $addToSet: '$id_hoc_sinh' } } }, { $project: { attempts: 1, average: 1, best: 1, students: { $size: '$students' } } }],
        daily: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$ngay_lam_bai', timezone: 'Asia/Bangkok' } }, attempts: { $sum: 1 }, average: { $avg: '$diem' } } }, { $sort: { _id: 1 } }],
      };
      if (includeClasses) facets.classes = [
        { $match: { id_lop_hoc: { $ne: null } } },
        { $group: { _id: '$id_lop_hoc', attempts: { $sum: 1 }, students: { $addToSet: '$id_hoc_sinh' }, average: { $avg: '$diem' } } },
        { $sort: { attempts: -1, _id: 1 } }, { $limit: 6 },
        { $lookup: { from: LopHoc.collection.name, localField: '_id', foreignField: '_id', as: 'classInfo' } },
        { $project: { attempts: 1, average: 1, students: { $size: '$students' }, name: { $ifNull: [{ $arrayElemAt: ['$classInfo.ten_lop', 0] }, 'Lớp không còn tồn tại'] } } },
      ];
      const [result] = await KetQuaBaiThi.aggregate([{ $match: match }, { $facet: facets }]);
      return { summary: result.summary[0] || { attempts: 0, average: 0, best: 0, students: 0 }, daily: result.daily, classes: result.classes || [] };
    };
    const [mine, classStats] = await Promise.all([summarize(personal, false), management ? summarize(classScope, true) : null]);
    res.json({ success: true, data: { days, personal: mine, management: classStats } });
  } catch (error) {
    console.error('Lỗi thống kê trang chủ:', error);
    res.status(500).json({ success: false, message: 'Không thể tải thống kê trang chủ' });
  }
};

// Lấy lịch sử thi của tất cả học viên (Admin/GV)
exports.getLichSuThi = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      // Bộ lọc
      hoc_sinh_id = "",
      lop_hoc_id = "",
      bai_giang_id = "",
      // Tìm kiếm
      search = "",
      // Sắp xếp
      sortBy = "ngay_lam_bai",
      sortOrder = "desc"
    } = req.query;

    // Xây dựng query
    const query = {};

    // Nếu là giáo viên, chỉ xem bài thi của học viên thuộc lớp của mình
    if (req.user.role === 'giaovien') {
      const lopCuaGV = await LopHoc.find({ id_giaovien: req.user.id }).select('_id');
      const lopIds = lopCuaGV.map(lop => lop._id);
      query.id_lop_hoc = { $in: lopIds };
    }

    // Filter theo lớp học
    if (lop_hoc_id) {
      if (req.user.role === 'giaovien' && !query.id_lop_hoc.$in.some(id => String(id) === String(lop_hoc_id))) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xem lớp này' });
      }
      query.id_lop_hoc = lop_hoc_id;
    }

    // Filter theo bài giảng
    if (bai_giang_id) {
      query.id_bai_giang = bai_giang_id;
    }

    // Filter theo học sinh cụ thể
    if (hoc_sinh_id) {
      query.id_hoc_sinh = hoc_sinh_id;
    }

    // Tìm kiếm theo tên/MSSV/email học sinh
    // Sử dụng aggregation để join với NguoiDung trước khi tìm kiếm
    let searchMatch = {};
    if (search) {
      // Escape special regex characters
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      
      // Tìm các _id của học sinh thỏa điều kiện
      const hocSinhMatches = await NguoiDung.find({
        $or: [
          { ho_ten: searchRegex },
          { ma_so: searchRegex },
          { email: searchRegex },
          { so_dien_thoai: searchRegex },
          { ten_lop_sinh_hoat: searchRegex }
        ]
      }).select('_id');
      
      const hocSinhIds = hocSinhMatches.map(hs => hs._id);
      
      // Tìm các bài giảng có tên chứa từ khóa
      const baiGiangMatches = await BaiGiang.find({
        ten_bai_giang: searchRegex
      }).select('_id');
      
      const baiGiangIds = baiGiangMatches.map(bg => bg._id);
      
      searchMatch = {
        $or: [
          { id_hoc_sinh: { $in: hocSinhIds } },
          { id_bai_giang: { $in: baiGiangIds } }
        ]
      };
    }

    if (req.query.group_by === 'student') {
      const matching = await KetQuaBaiThi.find({ ...query, ...searchMatch })
        .select('id_hoc_sinh diem ngay_lam_bai').sort({ ngay_lam_bai: -1 }).lean();
      const grouped = new Map();
      for (const item of matching) {
        const key = String(item.id_hoc_sinh || item._id);
        if (!grouped.has(key)) grouped.set(key, { studentId: item.id_hoc_sinh, count: 0, sum: 0, best: null, latest: item.ngay_lam_bai });
        const group = grouped.get(key);
        group.count++;
        const score = Number(item.diem) || 0;
        group.sum += score;
        group.best = group.best === null ? score : Math.max(group.best, score);
      }
      const groups = [...grouped.values()];
      const pageNumber = Math.max(1, parseInt(page) || 1);
      const pageLimit = Math.max(1, Math.min(100, parseInt(limit) || 10));
      const selected = groups.slice((pageNumber - 1) * pageLimit, pageNumber * pageLimit);
      const students = await NguoiDung.find({ _id: { $in: selected.map(group => group.studentId).filter(Boolean) } })
        .select('ho_ten ma_so email anh_dai_dien ten_lop_sinh_hoat').lean();
      const studentMap = new Map(students.map(student => [String(student._id), student]));
      return res.status(200).json({ success: true, data: {
        items: selected.map(group => ({ ...group, student: studentMap.get(String(group.studentId)) || null, average: group.sum / group.count })),
        pagination: { page: pageNumber, limit: pageLimit, total: groups.length, totalPages: Math.ceil(groups.length / pageLimit) }
      } });
    }

    // Đếm tổng
    const total = await KetQuaBaiThi.countDocuments({
      ...query,
      ...searchMatch
    });

    // Tính pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Query với populate
    const lichSuThi = await KetQuaBaiThi.find({
      ...query,
      ...searchMatch
    })
      .populate('id_hoc_sinh', 'ho_ten ma_so email anh_dai_dien so_dien_thoai ten_lop_sinh_hoat')
      .populate('id_bai_giang', 'ten_bai_giang maBaiGiang')
      .populate('id_lop_hoc', 'ten_lop ma_lop_random')
      .populate('id_giao_vien', 'ho_ten ma_so')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        items: lichSuThi,
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

// Lấy danh sách học viên đã thi của một bài giảng
exports.getHocVienDaThi = async (req, res) => {
  try {
    const { bai_giang_id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Lấy tất cả các lần thi của học viên cho bài giảng này
    const query = { id_bai_giang: bai_giang_id };

    // Nếu là giáo viên, kiểm tra quyền
    if (req.user.role === 'giaovien') {
      const baiGiang = await BaiGiang.findById(bai_giang_id);
      if (!baiGiang) {
        return res.status(404).json({ success: false, message: "Không tìm thấy bài giảng" });
      }
      const lop = await LopHoc.findById(baiGiang.id_lop_hoc);
      if (!lop || lop.id_giaovien.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: "Không có quyền xem" });
      }
    }

    // Group by học sinh để lấy lần thi cao nhất
    const hocVienList = await KetQuaBaiThi.aggregate([
      { $match: query },
      { $sort: { diem: -1, ngay_lam_bai: -1 } },
      {
        $group: {
          _id: "$id_hoc_sinh",
          thong_tin_hoc_sinh: { $first: "$id_hoc_sinh" },
          tong_lan_thi: { $sum: 1 },
          diem_cao_nhat: { $max: "$diem" },
          lan_thi_gan_nhat: { $last: "$ngay_lam_bai" },
          chi_tiet_lan_thi: { $push: {
            _id: "$_id",
            lan_thi: "$lan_thi",
            diem: "$diem",
            so_cau_dung: "$so_cau_dung",
            tong_so_cau: "$tong_so_cau",
            thoi_gian_lam_bai: "$thoi_gian_lam_bai",
            ngay_lam_bai: "$ngay_lam_bai"
          }}
        }
      },
      {
        $lookup: {
          from: 'nguoidungs',
          localField: 'thong_tin_hoc_sinh',
          foreignField: '_id',
          as: 'hoc_sinh_info'
        }
      },
      { $unwind: '$hoc_sinh_info' },
      {
        $project: {
          _id: 1,
          thong_tin_hoc_sinh: {
            _id: '$hoc_sinh_info._id',
            ho_ten: '$hoc_sinh_info.ho_ten',
            ma_so: '$hoc_sinh_info.ma_so',
            email: '$hoc_sinh_info.email',
            anh_dai_dien: '$hoc_sinh_info.anh_dai_dien'
          },
          tong_lan_thi: 1,
          diem_cao_nhat: 1,
          lan_thi_gan_nhat: 1,
          chi_tiet_lan_thi: { $slice: ['$chi_tiet_lan_thi', 5] } // Giới hạn 5 lần thi gần nhất
        }
      }
    ]);

    // Phân trang
    const total = hocVienList.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedList = hocVienList.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        items: paginatedList,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error("Lỗi lấy học viên đã thi:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Lấy chi tiết một bài thi cụ thể
exports.getChiTietBaiThi = async (req, res) => {
  try {
    const { id } = req.params;

    const ketQua = await KetQuaBaiThi.findById(id)
      .populate('id_hoc_sinh', 'ho_ten ma_so email anh_dai_dien so_dien_thoai')
      .populate('id_bai_giang', 'ten_bai_giang maBaiGiang danhSachCauHoi noi_dung_bai_hoc')
      .populate('id_lop_hoc', 'ten_lop ma_lop_random')
      .populate('id_giao_vien', 'ho_ten ma_so');

    if (!ketQua) {
      return res.status(404).json({ success: false, message: "Không tìm thấy bài thi" });
    }

    // Kiểm tra quyền
    if (req.user.role === 'giaovien') {
      const lop = await LopHoc.findById(ketQua.id_lop_hoc);
      if (!lop || lop.id_giaovien.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: "Không có quyền xem" });
      }
    }

    res.status(200).json({
      success: true,
      data: ketQua
    });

  } catch (error) {
    console.error("Lỗi lấy chi tiết bài thi:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Thống kê tổng quan cho dashboard
exports.getThongKe = async (req, res) => {
  try {
    const query = {};

    // Nếu là giáo viên
    if (req.user.role === 'giaovien') {
      const lopCuaGV = await LopHoc.find({ id_giaovien: req.user.id }).select('_id');
      const lopIds = lopCuaGV.map(lop => lop._id);
      query.id_lop_hoc = { $in: lopIds };
    }

    // Tổng số bài thi
    const tongBaiThi = await KetQuaBaiThi.countDocuments(query);

    // Tổng số học viên đã thi
    const hocVienDaThi = await KetQuaBaiThi.distinct('id_hoc_sinh', query);

    // Điểm trung bình
    const avgDiem = await KetQuaBaiThi.aggregate([
      { $match: query },
      { $group: { _id: null, avgDiem: { $avg: "$diem" } } }
    ]);

    // Điểm cao nhất và thấp nhất
    const diemStats = await KetQuaBaiThi.aggregate([
      { $match: query },
      { $group: { 
        _id: null, 
        diemCaoNhat: { $max: "$diem" },
        diemThapNhat: { $min: "$diem" }
      }}
    ]);

    // Top học viên xuất sắc
    const topHocVien = await KetQuaBaiThi.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$id_hoc_sinh",
          tongDiem: { $sum: "$diem" },
          soLanThi: { $sum: 1 }
        }
      },
      { $sort: { tongDiem: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'nguoidungs',
          localField: '_id',
          foreignField: '_id',
          as: 'hoc_sinh'
        }
      },
      { $unwind: '$hoc_sinh' },
      {
        $project: {
          _id: 1,
          ho_ten: '$hoc_sinh.ho_ten',
          ma_so: '$hoc_sinh.ma_so',
          anh_dai_dien: '$hoc_sinh.anh_dai_dien',
          tongDiem: 1,
          soLanThi: 1
        }
      }
    ]);

    // Thống kê theo ngày (7 ngày gần nhất)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thongKeNgay = await KetQuaBaiThi.aggregate([
      { $match: { ...query, ngay_lam_bai: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$ngay_lam_bai" } },
          so_bai_thi: { $sum: 1 },
          diem_trung_binh: { $avg: "$diem" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        tongBaiThi,
        tongHocVien: hocVienDaThi.length,
        diemTrungBinh: avgDiem[0]?.avgDiem || 0,
        diemCaoNhat: diemStats[0]?.diemCaoNhat || 0,
        diemThapNhat: diemStats[0]?.diemThapNhat || 0,
        topHocVien,
        thongKeNgay
      }
    });

  } catch (error) {
    console.error("Lỗi thống kê:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Lấy danh sách lớp cho filter (GV xem lớp của mình, Admin xem tất cả)
exports.getDanhSachLopFilter = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'giaovien') {
      query.id_giaovien = req.user.id;
    }

    const lopList = await LopHoc.find(query)
      .select('ten_lop ma_lop_random')
      .sort({ ten_lop: 1 });

    res.status(200).json({
      success: true,
      data: lopList
    });

  } catch (error) {
    console.error("Lỗi lấy danh sách lớp:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Lấy danh sách bài giảng cho filter (chỉ bài giảng của GV hoặc tất cả nếu Admin)
exports.getDanhSachBaiGiangFilter = async (req, res) => {
  try {
    const { lop_hoc_id } = req.query;
    let query = {};

    if (req.user.role === 'giaovien') {
      const lopCuaGV = await LopHoc.find({ id_giaovien: req.user.id }).select('_id');
      query.id_lop_hoc = { $in: lopCuaGV.map(lop => lop._id) };
    }

    if (lop_hoc_id) {
      query.id_lop_hoc = lop_hoc_id;
    }

    const baiGiangList = await BaiGiang.find(query)
      .select('ten_bai_giang maBaiGiang id_lop_hoc')
      .populate('id_lop_hoc', 'ten_lop')
      .sort({ ten_bai_giang: 1 });

    res.status(200).json({
      success: true,
      data: baiGiangList
    });

  } catch (error) {
    console.error("Lỗi lấy danh sách bài giảng:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
