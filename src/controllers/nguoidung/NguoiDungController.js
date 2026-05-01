const bcrypt = require("bcryptjs");
const NguoiDung = require("../../models/NguoiDung");


exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role, isActive, filterAuthors } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // 1. Bộ lọc cơ bản (Giữ nguyên)
    let matchQuery = {};
    if (search) {
      matchQuery.$or = [
        { ho_ten: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { so_dien_thoai: { $regex: search, $options: "i" } }
      ];
    }
    if (role) matchQuery.role = role;
    if (isActive !== undefined) matchQuery.isActive = isActive === 'true';

    let pipeline = [{ $match: matchQuery }];


    const results = await NguoiDung.aggregate(pipeline);
    
    const users = results[0].data;
    const totalUsers = results[0].metadata[0]?.total || 0;

    res.status(200).json({
      success: true,
      users,
      totalPages: Math.ceil(totalUsers / limitNum),
      totalUsers,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
  }
};

// 2. Lấy chi tiết người dùng
exports.getUserById = async (req, res) => {
  try {
    const user = await NguoiDung.findById(req.params.id).select("-mat_khau -maOTP -currentToken")
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error });
  }
};

// 3. Tạo người dùng mới (Dành cho Admin tạo nhân viên)
exports.createUser = async (req, res) => {
  try {
    const { email, mat_khau, so_dien_thoai, ma_so } = req.body;
    
    // Kiểm tra trùng lặp
    const existingUser = await NguoiDung.findOne({ $or: [{ email }, { so_dien_thoai }, { ma_so }] });
    if (existingUser) return res.status(400).json({ message: "Email, số điện thoại hoặc mã số đã tồn tại" });
    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(mat_khau, salt);

    const newUser = new NguoiDung({ ...req.body, mat_khau: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "Tạo tài khoản thành công ✨", user: { email: newUser.email, role: newUser.role } });
  } catch (error) {
    res.status(400).json({ message: "Lỗi tạo tài khoản", error: error.message });
  }
};

// 4. Cập nhật thông tin người dùng
exports.updateUser = async (req, res) => {
  try {
    const { password } = req.body;
    const updateData = { ...req.body };

    // Nếu có đổi mật khẩu thì mã hóa lại
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.mat_khau = await bcrypt.hash(password, salt);
    }

    const updated = await NguoiDung.findByIdAndUpdate(req.params.id, updateData, { new: true }).select("-mat_khau -maOTP -currentToken");
    res.status(200).json({ message: "Cập nhật thành công", data: updated });
  } catch (error) {
    res.status(400).json({ message: "Lỗi cập nhật", error: error.message });
  }
};

// 5. Khóa/Mở khóa tài khoản (toggleActive)
exports.toggleUserActive = async (req, res) => {
  try {
    const user = await NguoiDung.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    user.isActive = !user.isActive;
    await user.save();
    res.status(200).json({ message: user.isActive ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản", isActive: user.isActive });
  } catch (error) {
    res.status(500).json({ message: "Lỗi hệ thống", error });
  }
};

// 6. Xóa người dùng
exports.deleteUser = async (req, res) => {
  try {
    await NguoiDung.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Đã xóa người dùng vĩnh viễn" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi xóa", error });
  }
};
