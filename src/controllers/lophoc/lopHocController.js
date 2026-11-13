const LopHoc = require("../../models/LopHoc");
const { generateClassCode } = require("../../utils/randomCode");
const notifyMembership = (req, classroom, studentId, status) => {
  const io = req.app.get('socketio');
  io?.to('admins').to(`user:${classroom.id_giaovien}`).to(`user:${studentId}`)
    .emit('class:membership', { classId: String(classroom._id), studentId: String(studentId), status });
  io?.to(`user:${classroom.id_giaovien}`).emit('class:approval-notification', { classId: String(classroom._id) });
};

const lopHocController = {
  pendingRequests: async (req, res) => {
    try {
      const classes = await LopHoc.find({
        id_giaovien: req.user.id,
        'danh_sach_hoc_vien.trang_thai_phe_duyet': 'cho_phe_duyet',
      }).select('ten_lop danh_sach_hoc_vien')
        .populate('danh_sach_hoc_vien.id_hoc_vien', 'ho_ten ma_so');
      const items = classes.flatMap(classroom => classroom.danh_sach_hoc_vien
        .filter(member => member.trang_thai_phe_duyet === 'cho_phe_duyet' && member.id_hoc_vien)
        .map(member => ({ classId: String(classroom._id), className: classroom.ten_lop,
          studentId: String(member.id_hoc_vien._id), studentName: member.id_hoc_vien.ho_ten,
          studentCode: member.id_hoc_vien.ma_so, requestedAt: member.ngay_vao_lop })));
      items.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
      res.status(200).json({ items });
    } catch { res.status(500).json({ message: 'Không thể tải yêu cầu vào lớp' }); }
  },
  // 1. Tạo lớp học mới (Giao viên)
  createClass: async (req, res) => {
    try {
      const { ten_lop, id_mon_hoc, mo_ta_lop, si_so_toi_da, ngay_bat_dau, anh_lop } = req.body;
      
      // Tự động tạo mã lớp ngẫu nhiên và duy nhất
      const ma_lop_random = await generateClassCode();

      const newClass = new LopHoc({
        ten_lop,
        anh_lop,
        ma_lop_random,
        // id_mon_hoc,
        id_giaovien: req.user.id, // Lấy từ middleware auth
        mo_ta_lop,
        si_so_toi_da,
        ngay_bat_dau
      });

      await newClass.save();
      res.status(201).json({ message: "Tạo lớp học thành công", data: newClass });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

    // 🟢 API: Đổi mã lớp ngẫu nhiên cho một lớp đang tồn tại
  refreshClassCode: async (req, res) => {
    try {
      const { id } = req.params;

      // 1. Kiểm tra quyền (Chỉ giáo viên tạo lớp hoặc admin mới được đổi)
      const lopHoc = await LopHoc.findById(id);
      if (!lopHoc) return res.status(404).json({ message: "Không tìm thấy lớp học" });
      
      if (req.user.role !== 'admin' && lopHoc.id_giaovien.toString() !== req.user.id) {
        return res.status(403).json({ message: "Bạn không có quyền đổi mã lớp này" });
      }

      // 2. Sinh mã mới (Hàm này đã có logic check trùng trong utils/randomCode.js)
      const newCode = await generateClassCode();

      // 3. Cập nhật trực tiếp vào DB
      lopHoc.ma_lop_random = newCode;
      await lopHoc.save();

      res.status(200).json({ 
        success: true,
        message: "Đã làm mới mã lớp thành công",
        ma_lop_random: newCode 
      });
    } catch (error) {
      res.status(500).json({ message: "Lỗi khi làm mới mã lớp" });
    }
  },

  // 2. Lấy danh sách lớp học (Có lọc theo giáo viên hoặc tất cả)
  getAllClasses: async (req, res) => {
    try {
      const filters = {};
      if (req.user.role === 'giaovien') filters.id_giaovien = req.user.id;

      const isManagement = ['admin', 'giaovien'].includes(req.user.role);

      // Keep the original array response for callers without pagination.
      const paginated = req.query.page !== undefined || req.query.limit !== undefined;
      const search = String(req.query.search || '').trim().slice(0, 200);
      if (search) {
        const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filters.ten_lop = { $regex: literal, $options: 'i' };
      }
      const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 6));
      const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);
      let total = 0;
      let page = requestedPage;
      let summary;
      if (paginated) {
        const summaryFilter = req.user.role === 'giaovien'
          ? { id_giaovien: new LopHoc.base.Types.ObjectId(req.user.id) }
          : {};
        const [count, stats] = await Promise.all([
          LopHoc.countDocuments(filters),
          LopHoc.aggregate([
            { $match: summaryFilter },
            { $group: {
              _id: null,
              totalClasses: { $sum: 1 },
              totalStudents: { $sum: { $size: { $filter: {
                input: { $ifNull: ['$danh_sach_hoc_vien', []] }, as: 'member',
                cond: { $eq: ['$$member.trang_thai_phe_duyet', 'da_tham_gia'] }
              } } } },
              pendingStudents: { $sum: { $size: { $filter: {
                input: { $ifNull: ['$danh_sach_hoc_vien', []] }, as: 'member',
                cond: { $eq: ['$$member.trang_thai_phe_duyet', 'cho_phe_duyet'] }
              } } } }
            } },
            { $project: { _id: 0 } }
          ])
        ]);
        total = count;
        page = Math.min(requestedPage, Math.max(1, Math.ceil(total / limit)));
        summary = stats[0] || { totalClasses: 0, totalStudents: 0, pendingStudents: 0 };
      }

      const query = LopHoc.find(filters)
        .select(isManagement ? "" : "-ma_lop_random")
        // .populate('id_mon_hoc', 'ten_mon_hoc')
        .populate('id_giaovien', 'ho_ten email anh_dai_dien')
        .populate({
            path: 'danh_sach_hoc_vien.id_hoc_vien',
            select: 'ho_ten email anh_dai_dien ma_so' // Chỉ lấy các trường cần thiết
        })
        .sort({ _id: -1 });

      if (paginated) query.skip((page - 1) * limit).limit(limit);
      const classes = await query;
      res.status(200).json(paginated
        ? { items: classes, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, summary }
        : classes);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // 2. Giáo viên phê duyệt học viên vào lớp
  approveStudent: async (req, res) => {
    try {
      const { classId, studentId, status } = req.body; // status: 'da_tham_gia' hoặc 'bi_tu_choi'

      if (!['da_tham_gia', 'bi_tu_choi'].includes(status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
      const lopHoc = await LopHoc.findOne({ _id: classId, ...(req.user.role === 'admin' ? {} : { id_giaovien: req.user.id }) });
      if (!lopHoc) return res.status(403).json({ message: "Bạn không có quyền quản lý lớp này" });

      // Tìm học viên trong danh sách chờ
      const studentIndex = lopHoc.danh_sach_hoc_vien.findIndex(
        item => item.id_hoc_vien.toString() === studentId
      );

      if (studentIndex === -1) {
        return res.status(404).json({ message: "Không tìm thấy yêu cầu tham gia của học viên này" });
      }

      // Cập nhật trạng thái
      lopHoc.danh_sach_hoc_vien[studentIndex].trang_thai_phe_duyet = status;
      await lopHoc.save();
      notifyMembership(req, lopHoc, studentId, status);

      res.status(200).json({ message: `Đã ${status === 'da_tham_gia' ? 'duyệt' : 'từ chối'} học viên` });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // 3. Lấy chi tiết 1 lớp học
  getClassById: async (req, res) => {
    try {
      const lopHoc = await LopHoc.findById(req.params.id)
        .select("-ma_lop_random")
        // .populate('id_mon_hoc')
        .populate('id_giaovien', 'ho_ten email')
        .populate('danh_sach_hoc_vien.id_hoc_vien', 'ho_ten ma_so email');
      
      if (!lopHoc) return res.status(404).json({ message: "Không tìm thấy lớp" });
      res.status(200).json(lopHoc);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // 4. Cập nhật thông tin lớp
  updateClass: async (req, res) => {
    try {
      const updatedClass = await LopHoc.findOneAndUpdate(
        { _id: req.params.id, id_giaovien: req.user.id },
        { $set: req.body },
        { new: true }
      );
      if (!updatedClass) return res.status(403).json({ message: "Không có quyền sửa lớp này" });
      res.status(200).json({ message: "Cập nhật thành công", data: updatedClass });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // 5. Xóa lớp học
  deleteClass: async (req, res) => {
    try {
      const deletedClass = await LopHoc.findOneAndDelete({ 
        _id: req.params.id, 
        id_giaovien: req.user.id 
      });
      if (!deletedClass) return res.status(403).json({ message: "Không thể xóa lớp này" });
      res.status(200).json({ message: "Đã xóa lớp học" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // 6. Học viên nhập mã để xin vào lớp
  joinClassByCode: async (req, res) => {
    try {
      const { ma_lop_random } = req.body;
      const lopHoc = await LopHoc.findOne({ ma_lop_random });

      if (!lopHoc) return res.status(404).json({ message: "Mã lớp không chính xác" });

      // Kiểm tra xem đã tham gia chưa
      const membership = lopHoc.danh_sach_hoc_vien.find(
        item => item.id_hoc_vien.toString() === req.user.id
      );
      if (membership && membership.trang_thai_phe_duyet !== 'bi_tu_choi') return res.status(400).json({ message: "Bạn đã gửi yêu cầu hoặc đã ở trong lớp" });

      // Kiểm tra sĩ số
      const enrolled = lopHoc.danh_sach_hoc_vien.filter(item => item.trang_thai_phe_duyet === 'da_tham_gia').length;
      if (enrolled >= lopHoc.si_so_toi_da) {
        return res.status(400).json({ message: "Lớp đã đầy sĩ số" });
      }

      if (membership) {
        membership.trang_thai_phe_duyet = 'cho_phe_duyet';
        membership.ngay_vao_lop = new Date();
      } else {
        lopHoc.danh_sach_hoc_vien.push({ id_hoc_vien: req.user.id, trang_thai_phe_duyet: 'cho_phe_duyet' });
      }
      await lopHoc.save();
      notifyMembership(req, lopHoc, req.user.id, 'cho_phe_duyet');

      res.status(200).json({ message: "Gửi yêu cầu tham gia thành công, chờ phê duyệt" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

module.exports = lopHocController;
