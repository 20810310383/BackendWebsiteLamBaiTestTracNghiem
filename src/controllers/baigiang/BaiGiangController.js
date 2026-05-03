const BaiGiang = require("../../models/BaiGiang");
const LopHoc = require("../../models/LopHoc");
const mammoth = require("mammoth");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const baiGiangController = {
  // ============================================================
  // 1. TẠO BÀI GIẢNG MỚI
  // ============================================================
  createBaiGiang: async (req, res) => {
    try {
      const { id_lop_hoc, ten_bai_giang, anhDaiDien, gioiThieu, monHoc, noi_dung_bai_hoc, danhSachCauHoi, thoi_gian_lam_bai, giaBaiGiang } = req.body;

      // Kiểm tra lớp học tồn tại
      const lopHoc = await LopHoc.findById(id_lop_hoc);
      if (!lopHoc) {
        return res.status(404).json({ message: "Không tìm thấy lớp học" });
      }

      // Kiểm tra quyền: chỉ giáo viên của lớp hoặc admin mới được tạo
      if (req.user.role !== 'admin' && lopHoc.id_giaovien.toString() !== req.user.id) {
        return res.status(403).json({ message: "Bạn không có quyền tạo bài giảng cho lớp này" });
      }

      // Tạo bài giảng mới
      const newBaiGiang = new BaiGiang({
        id_lop_hoc,
        ten_bai_giang,
        anhDaiDien,
        gioiThieu,
        monHoc,
        noi_dung_bai_hoc: noi_dung_bai_hoc || "",
        danhSachCauHoi: danhSachCauHoi || [],
        thoi_gian_lam_bai: thoi_gian_lam_bai || 15,
        giaBaiGiang: giaBaiGiang || 0
      });

      await newBaiGiang.save();

      // Populate thông tin để trả về
      await newBaiGiang.populate('id_lop_hoc', 'ten_lop ma_lop_random');
      // await newBaiGiang.populate('monHoc', 'ten_mon_hoc');

      res.status(201).json({
        success: true,
        message: "Tạo bài giảng thành công",
        data: newBaiGiang
      });
    } catch (error) {
      console.error("Lỗi tạo bài giảng:", error);
      res.status(500).json({ message: "Lỗi khi tạo bài giảng", error: error.message });
    }
  },

  // ============================================================
  // 2. LẤY TẤT CẢ BÀI GIẢNG (Có phân trang, tìm kiếm, lọc)
  // ============================================================
  getAllBaiGiang: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        id_lop_hoc,
        sortBy = 'ngay_tao',
        order = 'desc'
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const limitNum = parseInt(limit);

      // Xây dựng query filter
      let matchQuery = {};

      // Tìm kiếm theo tên bài giảng
      if (search) {
        matchQuery.ten_bai_giang = { $regex: search, $options: 'i' };
      }

      // Lọc theo lớp học
      if (id_lop_hoc) {
        matchQuery.id_lop_hoc = id_lop_hoc;
      }

      // Nếu là giáo viên, chỉ hiện bài giảng của các lớp mình quản lý
      if (req.user.role === 'giaovien') {
        const lopHocCuaToi = await LopHoc.find({ id_giaovien: req.user.id }).select('_id');
        const lopHocIds = lopHocCuaToi.map(lop => lop._id);
        matchQuery.id_lop_hoc = { $in: lopHocIds };
      }

      // Sắp xếp
      const sortOptions = {};
      sortOptions[sortBy] = order === 'asc' ? 1 : -1;

      // Aggregation pipeline
      const pipeline = [
        { $match: matchQuery },
        { $sort: sortOptions },
        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: limitNum },
              {
                $lookup: {
                  from: 'lopHocs',
                  localField: 'id_lop_hoc',
                  foreignField: '_id',
                  as: 'lopHocInfo'
                }
              },
              { $unwind: { path: '$lopHocInfo', preserveNullAndEmptyArrays: true } },
              {
                $lookup: {
                  from: 'monhocs',
                  localField: 'monHoc',
                  foreignField: '_id',
                  as: 'monHocInfo'
                }
              },
              { $unwind: { path: '$monHocInfo', preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  maBaiGiang: 1,
                  ten_bai_giang: 1,
                  anhDaiDien: 1,
                  gioiThieu: 1,
                  noi_dung_bai_hoc: 1,
                  thoi_gian_lam_bai: 1,
                  giaBaiGiang: 1,
                  ngay_tao: 1,
                  soCauHoi: { $size: '$danhSachCauHoi' },
                  lopHocInfo: {
                    _id: '$lopHocInfo._id',
                    ten_lop: '$lopHocInfo.ten_lop',
                    ma_lop_random: '$lopHocInfo.ma_lop_random'
                  },
                  monHocInfo: {
                    _id: '$monHocInfo._id',
                    ten_mon_hoc: '$monHocInfo.ten_mon_hoc'
                  }
                }
              }
            ],
            metadata: [
              { $count: 'total' }
            ]
          }
        }
      ];

      const results = await BaiGiang.aggregate(pipeline);

      const baiGiangs = results[0].data;
      const totalBaiGiang = results[0].metadata[0]?.total || 0;

      res.status(200).json({
        success: true,
        baiGiangs,
        totalPages: Math.ceil(totalBaiGiang / limitNum),
        totalBaiGiang,
        currentPage: parseInt(page),
        limitPerPage: limitNum
      });
    } catch (error) {
      console.error("Lỗi lấy danh sách bài giảng:", error);
      res.status(500).json({ message: "Lỗi khi lấy danh sách bài giảng", error: error.message });
    }
  },

  // ============================================================
  // 3. LẤY CHI TIẾT MỘT BÀI GIẢNG
  // ============================================================
  getBaiGiangById: async (req, res) => {
    try {
      const { id } = req.params;

      const baiGiang = await BaiGiang.findById(id)
        .populate('id_lop_hoc', 'ten_lop ma_lop_random id_giaovien danh_sach_hoc_vien')
        // .populate('monHoc', 'ten_mon_hoc ma_mon_hoc');

      if (!baiGiang) {
        return res.status(404).json({ message: "Không tìm thấy bài giảng" });
      }

      // Kiểm tra quyền xem: giáo viên quản lý lớp, admin, hoặc học viên đã được duyệt
      const isGiaoVien = req.user.role === 'giaovien' && 
                         baiGiang.id_lop_hoc.id_giaovien.toString() === req.user.id;
      const isHocVien = baiGiang.id_lop_hoc.danh_sach_hoc_vien.some(
        hv => hv.id_hoc_vien.toString() === req.user.id && 
             hv.trang_thai_phe_duyet === 'da_tham_gia'
      );

      if (req.user.role !== 'admin' && !isGiaoVien && !isHocVien) {
        return res.status(403).json({ message: "Bạn không có quyền xem bài giảng này" });
      }

      // Ẩn đáp án đúng với học viên khi làm bài
      let danhSachCauHoiHienThi = baiGiang.danhSachCauHoi;
      if (req.user.role === 'hocsinh') {
        danhSachCauHoiHienThi = baiGiang.danhSachCauHoi.map(cauHoi => ({
          _id: cauHoi._id,
          noiDungCauHoi: cauHoi.noiDungCauHoi,
          cacDapAn: cauHoi.cacDapAn.map(dapAn => ({
            _id: dapAn._id,
            noiDungDapAn: dapAn.noiDungDapAn
            // Ẩn laDapAnDung
          })),
          giaiThich: cauHoi.giaiThich
        }));
      }

      res.status(200).json({
        success: true,
        data: {
          ...baiGiang.toObject(),
          danhSachCauHoi: danhSachCauHoiHienThi
        }
      });
    } catch (error) {
      console.error("Lỗi lấy chi tiết bài giảng:", error);
      res.status(500).json({ message: "Lỗi khi lấy chi tiết bài giảng", error: error.message });
    }
  },

  // ============================================================
  // 4. CẬP NHẬT BÀI GIẢNG
  // ============================================================
  updateBaiGiang: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Lấy bài giảng hiện tại
      const baiGiang = await BaiGiang.findById(id);
      if (!baiGiang) {
        return res.status(404).json({ message: "Không tìm thấy bài giảng" });
      }

      // Lấy thông tin lớp học để kiểm tra quyền
      const lopHoc = await LopHoc.findById(baiGiang.id_lop_hoc);
      if (!lopHoc) {
        return res.status(404).json({ message: "Không tìm thấy lớp học liên quan" });
      }

      // Kiểm tra quyền: chỉ giáo viên của lớp hoặc admin mới được sửa
      if (req.user.role !== 'admin' && lopHoc.id_giaovien.toString() !== req.user.id) {
        return res.status(403).json({ message: "Bạn không có quyền cập nhật bài giảng này" });
      }

      // Không cho sửa một số trường hệ thống
      delete updateData.maBaiGiang;
      delete updateData.id_lop_hoc;
      delete updateData.ngay_tao;

      // Cập nhật bài giảng
      const updatedBaiGiang = await BaiGiang.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      )
      .populate('id_lop_hoc', 'ten_lop ma_lop_random')
      // .populate('monHoc', 'ten_mon_hoc');

      res.status(200).json({
        success: true,
        message: "Cập nhật bài giảng thành công",
        data: updatedBaiGiang
      });
    } catch (error) {
      console.error("Lỗi cập nhật bài giảng:", error);
      res.status(500).json({ message: "Lỗi khi cập nhật bài giảng", error: error.message });
    }
  },

  // ============================================================
  // 5. XÓA BÀI GIẢNG
  // ============================================================
  deleteBaiGiang: async (req, res) => {
    try {
      const { id } = req.params;

      // Lấy bài giảng hiện tại
      const baiGiang = await BaiGiang.findById(id);
      if (!baiGiang) {
        return res.status(404).json({ message: "Không tìm thấy bài giảng" });
      }

      // Lấy thông tin lớp học để kiểm tra quyền
      const lopHoc = await LopHoc.findById(baiGiang.id_lop_hoc);
      if (!lopHoc) {
        return res.status(404).json({ message: "Không tìm thấy lớp học liên quan" });
      }

      // Kiểm tra quyền: chỉ giáo viên của lớp hoặc admin mới được xóa
      if (req.user.role !== 'admin' && lopHoc.id_giaovien.toString() !== req.user.id) {
        return res.status(403).json({ message: "Bạn không có quyền xóa bài giảng này" });
      }

      await BaiGiang.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: "Xóa bài giảng thành công"
      });
    } catch (error) {
      console.error("Lỗi xóa bài giảng:", error);
      res.status(500).json({ message: "Lỗi khi xóa bài giảng", error: error.message });
    }
  },

  // ============================================================
  // 6. LẤY BÀI GIẢNG THEO LỚP HỌC
  // ============================================================
  getBaiGiangByLopHoc: async (req, res) => {
    try {
      const { id_lop_hoc } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Tìm lớp học - hỗ trợ cả ObjectId và ma_lop_random
      let lopHoc;
      
      // Kiểm tra xem có phải ObjectId hợp lệ không (24 ký tự hex)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id_lop_hoc);
      
      if (isValidObjectId) {
        lopHoc = await LopHoc.findById({maKey: id_lop_hoc});
      } else {
        // Nếu không phải ObjectId, tìm theo ma_lop_random
        lopHoc = await LopHoc.findOne({ maKey: id_lop_hoc });
      }
      
      if (!lopHoc) {
        return res.status(404).json({ message: "Không tìm thấy lớp học" });
      }

      // Kiểm tra quyền xem
      const isGiaoVien = req.user.role === 'giaovien' && lopHoc.id_giaovien.toString() === req.user.id;
      const isHocVien = lopHoc.danh_sach_hoc_vien?.some(
        hv => hv.id_hoc_vien.toString() === req.user.id && hv.trang_thai_phe_duyet === 'da_tham_gia'
      );

      if (req.user.role !== 'admin' && !isGiaoVien && !isHocVien) {
        return res.status(403).json({ message: "Bạn không có quyền xem bài giảng của lớp này" });
      }

      const [baiGiangs, total] = await Promise.all([
        BaiGiang.find({ id_lop_hoc: lopHoc._id })
          // .populate('monHoc', 'ten_mon_hoc')
          .select('maBaiGiang ten_bai_giang anhDaiDien gioiThieu noi_dung_bai_hoc thoi_gian_lam_bai giaBaiGiang ngay_tao danhSachCauHoi')
          .sort({ ngay_tao: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        BaiGiang.countDocuments({ id_lop_hoc: lopHoc._id })
      ]);

      res.status(200).json({
        success: true,
        baiGiangs: baiGiangs.map(bg => ({
          ...bg.toObject(),
          soCauHoi: bg.danhSachCauHoi?.length || 0,
          danhSachCauHoi: undefined // Không trả về câu hỏi ở đây
        })),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalBaiGiang: total,
        currentPage: parseInt(page),
        lopHoc: {
          _id: lopHoc._id,
          ten_lop: lopHoc.ten_lop,
          ma_lop_random: lopHoc.ma_lop_random
        }
      });
    } catch (error) {
      console.error("Lỗi lấy bài giảng theo lớp học:", error);
      res.status(500).json({ message: "Lỗi khi lấy bài giảng", error: error.message });
    }
  },

  // ============================================================
  // 7. THÊM CÂU HỎI VÀO BÀI GIẢNG
  // ============================================================
  themCauHoi: async (req, res) => {
    try {
      const { id } = req.params;
      const { noiDungCauHoi, cacDapAn, giaiThich } = req.body;

      // Validate dữ liệu câu hỏi
      if (!noiDungCauHoi || !cacDapAn || cacDapAn.length < 2) {
        return res.status(400).json({ 
          message: "Câu hỏi phải có nội dung và ít nhất 2 đáp án" 
        });
      }

      // Kiểm tra có ít nhất 1 đáp án đúng
      const coDapAnDung = cacDapAn.some(dapAn => dapAn.laDapAnDung === true);
      if (!coDapAnDung) {
        return res.status(400).json({ 
          message: "Phải có ít nhất 1 đáp án đúng" 
        });
      }

      // Lấy bài giảng
      const baiGiang = await BaiGiang.findById(id);
      if (!baiGiang) {
        return res.status(404).json({ message: "Không tìm thấy bài giảng" });
      }

      // Kiểm tra quyền
      const lopHoc = await LopHoc.findById(baiGiang.id_lop_hoc);
      if (req.user.role !== 'admin' && lopHoc.id_giaovien.toString() !== req.user.id) {
        return res.status(403).json({ message: "Bạn không có quyền thêm câu hỏi vào bài giảng này" });
      }

      // Thêm câu hỏi mới
      const cauHoiMoi = {
        noiDungCauHoi,
        cacDapAn,
        giaiThich: giaiThich || ""
      };

      baiGiang.danhSachCauHoi.push(cauHoiMoi);
      await baiGiang.save();

      // Trả về câu hỏi vừa thêm
      const cauHoiVuaThem = baiGiang.danhSachCauHoi[baiGiang.danhSachCauHoi.length - 1];

      res.status(201).json({
        success: true,
        message: "Thêm câu hỏi thành công",
        cauHoi: cauHoiVuaThem,
        tongSoCauHoi: baiGiang.danhSachCauHoi.length
      });
    } catch (error) {
      console.error("Lỗi thêm câu hỏi:", error);
      res.status(500).json({ message: "Lỗi khi thêm câu hỏi", error: error.message });
    }
  },

  // ============================================================
  // 8. THÊM NHIỀU CÂU HỎI CÙNG LÚC
  // ============================================================
  themNhieuCauHoi: async (req, res) => {
    try {
      const { id } = req.params;
      const { cauHois } = req.body;

      if (!cauHois || !Array.isArray(cauHois) || cauHois.length === 0) {
        return res.status(400).json({ message: "Danh sách câu hỏi không hợp lệ" });
      }

      // Validate từng câu hỏi
      for (let i = 0; i < cauHois.length; i++) {
        const cauHoi = cauHois[i];
        if (!cauHoi.noiDungCauHoi || !cauHoi.cacDapAn || cauHoi.cacDapAn.length < 2) {
          return res.status(400).json({ 
            message: `Câu hỏi #${i + 1}: Phải có nội dung và ít nhất 2 đáp án` 
          });
        }
        const coDapAnDung = cauHoi.cacDapAn.some(dapAn => dapAn.laDapAnDung === true);
        if (!coDapAnDung) {
          return res.status(400).json({ 
            message: `Câu hỏi #${i + 1}: Phải có ít nhất 1 đáp án đúng` 
          });
        }
      }

      const baiGiang = await BaiGiang.findById(id);
      if (!baiGiang) {
        return res.status(404).json({ message: "Không tìm thấy bài giảng" });
      }

      const lopHoc = await LopHoc.findById(baiGiang.id_lop_hoc);
      if (req.user.role !== 'admin' && lopHoc.id_giaovien.toString() !== req.user.id) {
        return res.status(403).json({ message: "Bạn không có quyền thêm câu hỏi" });
      }

      // Thêm nhiều câu hỏi
      const cauHoisMoi = cauHois.map(cauHoi => ({
        noiDungCauHoi: cauHoi.noiDungCauHoi,
        cacDapAn: cauHoi.cacDapAn,
        giaiThich: cauHoi.giaiThich || ""
      }));

      baiGiang.danhSachCauHoi.push(...cauHoisMoi);
      await baiGiang.save();

      res.status(201).json({
        success: true,
        message: `Thêm thành công ${cauHois.length} câu hỏi`,
        soCauHoiThem: cauHois.length,
        tongSoCauHoi: baiGiang.danhSachCauHoi.length
      });
    } catch (error) {
      console.error("Lỗi thêm nhiều câu hỏi:", error);
      res.status(500).json({ message: "Lỗi khi thêm câu hỏi", error: error.message });
    }
  },

  // ============================================================
  // 9. CẬP NHẬT CÂU HỎI TRONG BÀI GIẢNG
  // ============================================================
  updateCauHoi: async (req, res) => {
    try {
      const { id, cauHoiId } = req.params;
      const updateData = req.body;

      const baiGiang = await BaiGiang.findById(id);
      if (!baiGiang) {
        return res.status(404).json({ message: "Không tìm thấy bài giảng" });
      }

      // Kiểm tra quyền
      const lopHoc = await LopHoc.findById(baiGiang.id_lop_hoc);
      if (req.user.role !== 'admin' && lopHoc.id_giaovien.toString() !== req.user.id) {
        return res.status(403).json({ message: "Bạn không có quyền cập nhật câu hỏi" });
      }

      // Tìm câu hỏi
      const cauHoiIndex = baiGiang.danhSachCauHoi.findIndex(
        ch => ch._id.toString() === cauHoiId
      );

      if (cauHoiIndex === -1) {
        return res.status(404).json({ message: "Không tìm thấy câu hỏi" });
      }

      // Validate nếu có đáp án
      if (updateData.cacDapAn) {
        if (updateData.cacDapAn.length < 2) {
          return res.status(400).json({ message: "Phải có ít nhất 2 đáp án" });
        }
        const coDapAnDung = updateData.cacDapAn.some(dapAn => dapAn.laDapAnDung === true);
        if (!coDapAnDung) {
          return res.status(400).json({ message: "Phải có ít nhất 1 đáp án đúng" });
        }
      }

      // Cập nhật câu hỏi
      const cauHoiHienTai = baiGiang.danhSachCauHoi[cauHoiIndex];
      baiGiang.danhSachCauHoi[cauHoiIndex] = {
        ...cauHoiHienTai.toObject(),
        ...updateData
      };

      await baiGiang.save();

      res.status(200).json({
        success: true,
        message: "Cập nhật câu hỏi thành công",
        cauHoi: baiGiang.danhSachCauHoi[cauHoiIndex]
      });
    } catch (error) {
      console.error("Lỗi cập nhật câu hỏi:", error);
      res.status(500).json({ message: "Lỗi khi cập nhật câu hỏi", error: error.message });
    }
  },

  // ============================================================
  // 10. XÓA CÂU HỎI KHỎI BÀI GIẢNG
  // ============================================================
  xoaCauHoi: async (req, res) => {
    try {
      const { id, cauHoiId } = req.params;

      const baiGiang = await BaiGiang.findById(id);
      if (!baiGiang) {
        return res.status(404).json({ message: "Không tìm thấy bài giảng" });
      }

      // Kiểm tra quyền
      const lopHoc = await LopHoc.findById(baiGiang.id_lop_hoc);
      if (req.user.role !== 'admin' && lopHoc.id_giaovien.toString() !== req.user.id) {
        return res.status(403).json({ message: "Bạn không có quyền xóa câu hỏi" });
      }

      // Tìm và xóa câu hỏi
      const cauHoiIndex = baiGiang.danhSachCauHoi.findIndex(
        ch => ch._id.toString() === cauHoiId
      );

      if (cauHoiIndex === -1) {
        return res.status(404).json({ message: "Không tìm thấy câu hỏi" });
      }

      baiGiang.danhSachCauHoi.splice(cauHoiIndex, 1);
      await baiGiang.save();

      res.status(200).json({
        success: true,
        message: "Xóa câu hỏi thành công",
        tongSoCauHoi: baiGiang.danhSachCauHoi.length
      });
    } catch (error) {
      console.error("Lỗi xóa câu hỏi:", error);
      res.status(500).json({ message: "Lỗi khi xóa câu hỏi", error: error.message });
    }
  },

  // ============================================================
  // 11. SẮP XẾP LẠI THỨ TỰ CÂU HỎI
  // ============================================================
  sapXepCauHoi: async (req, res) => {
    try {
      const { id } = req.params;
      const { cauHoiIds } = req.body;

      if (!cauHoiIds || !Array.isArray(cauHoiIds)) {
        return res.status(400).json({ message: "Danh sách ID câu hỏi không hợp lệ" });
      }

      const baiGiang = await BaiGiang.findById(id);
      if (!baiGiang) {
        return res.status(404).json({ message: "Không tìm thấy bài giảng" });
      }

      // Kiểm tra quyền
      const lopHoc = await LopHoc.findById(baiGiang.id_lop_hoc);
      if (req.user.role !== 'admin' && lopHoc.id_giaovien.toString() !== req.user.id) {
        return res.status(403).json({ message: "Bạn không có quyền sắp xếp câu hỏi" });
      }

      // Kiểm tra số lượng câu hỏi khớp
      if (cauHoiIds.length !== baiGiang.danhSachCauHoi.length) {
        return res.status(400).json({ 
          message: "Số lượng câu hỏi không khớp với danh sách hiện tại" 
        });
      }

      // Tạo map để tìm câu hỏi theo ID
      const cauHoiMap = new Map(
        baiGiang.danhSachCauHoi.map(ch => [ch._id.toString(), ch])
      );

      // Sắp xếp lại theo thứ tự mới
      const danhSachMoi = [];
      for (const cauHoiId of cauHoiIds) {
        const cauHoi = cauHoiMap.get(cauHoiId);
        if (!cauHoi) {
          return res.status(400).json({ 
            message: `Không tìm thấy câu hỏi với ID: ${cauHoiId}` 
          });
        }
        danhSachMoi.push(cauHoi);
      }

      baiGiang.danhSachCauHoi = danhSachMoi;
      await baiGiang.save();

      res.status(200).json({
        success: true,
        message: "Sắp xếp câu hỏi thành công"
      });
    } catch (error) {
      console.error("Lỗi sắp xếp câu hỏi:", error);
      res.status(500).json({ message: "Lỗi khi sắp xếp câu hỏi", error: error.message });
    }
  },

  // ============================================================
  // 12. LẤY THỐNG KÊ BÀI GIẢNG (CHO DASHBOARD)
  // ============================================================
  getThongKeBaiGiang: async (req, res) => {
    try {
      const { id_lop_hoc } = req.query;
      let matchCondition = {};

      // Nếu là giáo viên, chỉ thống kê bài giảng của mình
      if (req.user.role === 'giaovien') {
        const lopHocCuaToi = await LopHoc.find({ id_giaovien: req.user.id }).select('_id');
        matchCondition.id_lop_hoc = { $in: lopHocCuaToi.map(lop => lop._id) };
      }

      if (id_lop_hoc) {
        matchCondition.id_lop_hoc = id_lop_hoc;
      }

      const stats = await BaiGiang.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: null,
            tongSoBaiGiang: { $sum: 1 },
            tongSoCauHoi: {
              $sum: { $size: '$danhSachCauHoi' }
            },
            baiGiangCoCauHoi: {
              $sum: { $cond: [{ $gt: [{ $size: '$danhSachCauHoi' }, 0] }, 1, 0] }
            },
            baiGiangKhongCauHoi: {
              $sum: { $cond: [{ $eq: [{ $size: '$danhSachCauHoi' }, 0] }, 1, 0] }
            }
          }
        }
      ]);

      const result = stats[0] || {
        tongSoBaiGiang: 0,
        tongSoCauHoi: 0,
        baiGiangCoCauHoi: 0,
        baiGiangKhongCauHoi: 0
      };

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Lỗi thống kê bài giảng:", error);
      res.status(500).json({ message: "Lỗi khi thống kê", error: error.message });
    }
  },

  // ============================================================
  // 13. IMPORT CÂU HỎI TỪ FILE WORD
  // ============================================================
  importCauHoiTuWord: async (req, res) => {
    try {
      const { id } = req.params;
      const { filename } = req.body;

      // Kiểm tra bài giảng tồn tại
      const baiGiang = await BaiGiang.findById(id);
      if (!baiGiang) {
        return res.status(404).json({ message: "Không tìm thấy bài giảng" });
      }

      // Kiểm tra quyền
      const lopHoc = await LopHoc.findById(baiGiang.id_lop_hoc);
      if (req.user.role !== 'admin' && lopHoc.id_giaovien.toString() !== req.user.id) {
        return res.status(403).json({ message: "Bạn không có quyền thêm câu hỏi vào bài giảng này" });
      }

      // Đường dẫn file (từ src/controllers/baigiang/ lên 3 cấp = Backend/)
      const filePath = path.join(__dirname, "../../../public/uploads/docs", filename);
      
      if (!fs.existsSync(filePath)) {
        // Debug: log path để kiểm tra
        console.log("File path:", filePath);
        console.log("File exists:", fs.existsSync(filePath));
        return res.status(400).json({ message: "File không tồn tại: " + filePath });
      }

      // Đọc file từ disk
      const buffer = fs.readFileSync(filePath);
      
      // Đọc raw text để parse
      const textResult = await mammoth.extractRawText({ buffer });
      const text = textResult.value;
      
      // Đọc HTML để detect bold (đáp án đúng)
      const htmlResult = await mammoth.convertToHtml({ buffer });
      const html = htmlResult.value;
      
      // Debug: log text và html
      console.log("=== RAW TEXT ===");
      console.log(text);
      console.log("=== HTML (first 2000 chars) ===");
      console.log(html.substring(0, 2000));

      // Parse câu hỏi
      const cauHois = parseQuestionsFromHtml(text, html);

      if (cauHois.length === 0) {
        return res.status(400).json({ 
          message: "Không tìm thấy câu hỏi nào trong file. Vui lòng kiểm tra định dạng.",
          debug: {
            textLength: text.length,
            htmlLength: html.length,
            textPreview: text.substring(0, 500)
          },
          huongDan: "Mỗi câu hỏi cách nhau 1 dòng trống. Đáp án đúng bôi đậm (bold) trong Word."
        });
      }

      // Thêm câu hỏi vào bài giảng
      baiGiang.danhSachCauHoi.push(...cauHois);
      await baiGiang.save();

      // Xóa file sau khi đã xử lý
      fs.unlinkSync(filePath);

      res.status(201).json({
        success: true,
        message: `Import thành công ${cauHois.length} câu hỏi`,
        soCauHoiThem: cauHois.length,
        tongSoCauHoi: baiGiang.danhSachCauHoi.length,
        chiTiet: cauHois.map((ch, i) => ({
          stt: i + 1,
          noiDung: ch.noiDungCauHoi.substring(0, 50) + '...'
        }))
      });
    } catch (error) {
      console.error("Lỗi import Word:", error);
      res.status(500).json({ message: "Lỗi khi import file Word", error: error.message });
    }
  }
};

// Hàm parse câu hỏi từ HTML
// - 5 paragraphs liên tiếp = 1 câu hỏi (câu hỏi + 4 đáp án)
// - Đáp án đúng được bôi đậm (bold) trong Word
function parseQuestionsFromHtml(text, html) {
  const cauHois = [];
  const $ = cheerio.load(html);
  
  // Lấy danh sách paragraphs với thông tin bold
  const paragraphs = [];
  $('p').each((i, el) => {
    const $el = $(el);
    const htmlContent = $.html(el);
    const textContent = $el.text().trim();
    
    if (!textContent) return;
    
    // Kiểm tra xem có chứa text bold không (đáp án đúng)
    const isCorrect = htmlContent.includes('<strong>') || htmlContent.includes('<b>');
    
    // Lấy text bên trong thẻ bold nếu có
    let correctText = null;
    if (isCorrect) {
      const $strong = $el.find('strong').first();
      if ($strong.length) {
        correctText = $strong.text().trim().replace(/^[A-D]\.\s*/, '');
      }
    }
    
    paragraphs.push({
      text: textContent,
      isCorrect,
      correctText
    });
  });
  
  console.log("Total paragraphs:", paragraphs.length);
  
  // Nhóm 5 paragraphs = 1 câu hỏi (câu hỏi + 4 đáp án)
  // Sau 4 câu hỏi có thể có 1 dòng Note: (giải thích)
  for (let i = 0; i + 4 < paragraphs.length; i += 5) {
    const question = paragraphs[i].text;
    const answers = paragraphs.slice(i + 1, i + 5);
    
    // Tìm đáp án đúng
    const correctIndex = answers.findIndex(a => a.isCorrect);
    
    if (correctIndex === -1) {
      console.log("Không tìm thấy đáp án đúng cho câu:", question);
      continue;
    }
    
    // Kiểm tra dòng giải thích (paragraph tiếp theo hoặc trong answers)
    let giaiThich = "";
    const nextPara = paragraphs[i + 5];
    if (nextPara) {
      const noteMatch = nextPara.text.match(/^(Note|Giải thích|Lưu ý|Lời giải|Explanation):?\s*(.*)/i);
      if (noteMatch) {
        giaiThich = noteMatch[2].trim();
      } else if (!/^[A-D][.)]/.test(nextPara.text)) {
        // Không phải đáp án => có thể là giải thích
        giaiThich = nextPara.text;
      }
    }
    
    // Parse đáp án - bỏ prefix "A. ", "B. ", "C. ", "D. "
    const danhSachDapAn = answers.map(a => {
      if (a.correctText) {
        return a.correctText;
      }
      return a.text.replace(/^[A-D]\.\s*/, '').trim();
    });
    
    // Tạo object câu hỏi - đúng format model
    const cauHoi = {
      noiDungCauHoi: question,
      cacDapAn: danhSachDapAn.map((nd, idx) => ({
        noiDungDapAn: nd,
        laDapAnDung: idx === correctIndex
      })),
      giaiThich
    };
    
    cauHois.push(cauHoi);
    console.log("Parsed:", question.substring(0, 30), "=> Correct:", danhSachDapAn[correctIndex], giaiThich ? "(Note: " + giaiThich.substring(0, 20) + ")" : "");
  }
  
  console.log("Total questions parsed:", cauHois.length);
  return cauHois;
}

module.exports = baiGiangController;
