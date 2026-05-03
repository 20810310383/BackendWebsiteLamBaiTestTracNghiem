const NguoiDung = require("../../models/NguoiDung");
const LopHoc = require("../../models/LopHoc");
const bcrypt = require("bcryptjs");

// Lấy danh sách tất cả người dùng (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role = "",
      search = "",
      trang_thai = "",
      sortBy = "ngay_tao",
      sortOrder = "desc"
    } = req.query;

    const query = {};

    // Filter theo role
    if (role) {
      query.role = role;
    }

    // Filter theo trạng thái
    if (trang_thai !== "") {
      query.isActive = trang_thai === "true";
    }

    // Tìm kiếm
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { ho_ten: searchRegex },
        { ma_so: searchRegex },
        { email: searchRegex },
        { so_dien_thoai: searchRegex }
      ];
    }

    // Đếm tổng
    const total = await NguoiDung.countDocuments(query);

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const users = await NguoiDung.find(query)
      .select("-mat_khau -maOTP -currentToken")
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        items: users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách người dùng:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Lấy chi tiết một người dùng (Admin only)
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await NguoiDung.findById(id).select("-mat_khau -maOTP -currentToken");

    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Lấy thêm thông tin lớp học nếu là học sinh
    let additionalInfo = {};
    if (user.role === "hocsinh") {
      const lopHoc = await LopHoc.findOne({ danhSachHocSinh: user._id });
      additionalInfo.lop_hoc = lopHoc || null;
    }

    res.status(200).json({
      success: true,
      data: { ...user.toObject(), ...additionalInfo }
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết người dùng:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Tạo người dùng mới (Admin only)
exports.createUser = async (req, res) => {
  try {
    const { ma_so, ho_ten, email, so_dien_thoai, mat_khau, role, ten_lop_sinh_hoat } = req.body;

    // Kiểm tra trùng lặp
    const existingUser = await NguoiDung.findOne({
      $or: [{ ma_so }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Mã số hoặc email đã tồn tại"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(mat_khau, 10);

    const newUser = new NguoiDung({
      ma_so,
      ho_ten,
      email,
      so_dien_thoai,
      mat_khau: hashedPassword,
      role: role || "hocsinh",
      ten_lop_sinh_hoat,
      isActive: true,
      trang_thai_hoat_dong: true
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: "Tạo tài khoản thành công",
      data: {
        _id: newUser._id,
        ma_so: newUser.ma_so,
        ho_ten: newUser.ho_ten,
        email: newUser.email,
        role: newUser.role,
        trang_thai_hoat_dong: newUser.trang_thai_hoat_dong
      }
    });
  } catch (error) {
    console.error("Lỗi tạo người dùng:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Cập nhật người dùng (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { ho_ten, email, so_dien_thoai, ma_so, role, ten_lop_sinh_hoat } = req.body;

    const user = await NguoiDung.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Kiểm tra trùng lặp (nếu thay đổi)
    if (ma_so || email) {
      const existingUser = await NguoiDung.findOne({
        _id: { $ne: id },
        $or: [
          { ma_so: ma_so || { $exists: true } },
          { email: email || { $exists: true } }
        ]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Mã số hoặc email đã tồn tại"
        });
      }
    }

    // Cập nhật
    if (ho_ten) user.ho_ten = ho_ten;
    if (email) user.email = email;
    if (so_dien_thoai) user.so_dien_thoai = so_dien_thoai;
    if (ma_so) user.ma_so = ma_so;
    if (role) user.role = role;
    if (ten_lop_sinh_hoat !== undefined) user.ten_lop_sinh_hoat = ten_lop_sinh_hoat;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Cập nhật thông tin thành công",
      data: {
        _id: user._id,
        ma_so: user.ma_so,
        ho_ten: user.ho_ten,
        email: user.email,
        role: user.role,
        trang_thai_hoat_dong: user.trang_thai_hoat_dong
      }
    });
  } catch (error) {
    console.error("Lỗi cập nhật người dùng:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Đổi mật khẩu người dùng (Admin only)
exports.changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { mat_khau_moi } = req.body;

    const user = await NguoiDung.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Hash password mới
    const hashedPassword = await bcrypt.hash(mat_khau_moi, 10);
    user.mat_khau = hashedPassword;

    // Xóa token cũ
    user.currentToken = null;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Đổi mật khẩu thành công"
    });
  } catch (error) {
    console.error("Lỗi đổi mật khẩu:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Phân quyền người dùng (Admin only)
exports.changeRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, trang_thai_hoat_dong } = req.body;

    const user = await NguoiDung.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Không cho phép tự thay đổi quyền của chính mình
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "Không thể thay đổi quyền của chính bạn"
      });
    }

    // Cập nhật
    if (role) user.role = role;
    if (trang_thai_hoat_dong !== undefined) user.isActive = trang_thai_hoat_dong;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Phân quyền thành công",
      data: {
        _id: user._id,
        ho_ten: user.ho_ten,
        role: user.role,
        trang_thai_hoat_dong: user.trang_thai_hoat_dong
      }
    });
  } catch (error) {
    console.error("Lỗi phân quyền:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Khóa/Mở khóa tài khoản (Admin only)
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await NguoiDung.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Không cho phép khóa chính mình
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "Không thể khóa tài khoản của chính bạn"
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: user.isActive ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản",
      data: {
        _id: user._id,
        ho_ten: user.ho_ten,
        trang_thai_hoat_dong: user.isActive
      }
    });
  } catch (error) {
    console.error("Lỗi khóa/mở khóa tài khoản:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Xóa người dùng (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await NguoiDung.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    // Không cho phép xóa chính mình
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "Không thể xóa tài khoản của chính bạn"
      });
    }

    await NguoiDung.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Xóa tài khoản thành công"
    });
  } catch (error) {
    console.error("Lỗi xóa người dùng:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// Thống kê người dùng (Admin only)
exports.getStats = async (req, res) => {
  try {
    const [totalUsers, adminCount, giaoVienCount, hocSinhCount, activeCount, inactiveCount] = await Promise.all([
      NguoiDung.countDocuments(),
      NguoiDung.countDocuments({ role: "admin" }),
      NguoiDung.countDocuments({ role: "giaovien" }),
      NguoiDung.countDocuments({ role: "hocsinh" }),
      NguoiDung.countDocuments({ trang_thai_hoat_dong: true }),
      NguoiDung.countDocuments({ trang_thai_hoat_dong: false })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        byRole: {
          admin: adminCount,
          giaovien: giaoVienCount,
          hocsinh: hocSinhCount
        },
        byStatus: {
          active: activeCount,
          inactive: inactiveCount
        }
      }
    });
  } catch (error) {
    console.error("Lỗi thống kê người dùng:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
