const bcrypt = require("bcryptjs");
const NguoiDung = require("../../models/NguoiDung");
const TheoDoi = require("../../models/TheoDoi");

// 1. Lấy danh sách người dùng (Phân trang + Tìm kiếm + Lọc Role)
exports.getAllUsers1 = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role, isActive } = req.query;

    let query = {};
    if (search) {
      query.$or = [
        { hoTen: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { soDienThoai: { $regex: search, $options: "i" } },
        { maNguoiDung: { $regex: search, $options: "i" } },
      ];
    }
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive;

    const count = await NguoiDung.countDocuments(query);
    const users = await NguoiDung.find(query)
      .select("-password -maOTP") // Bảo mật: Không trả về password và OTP
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    res.status(200).json({
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalUsers: count,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách người dùng", error: error.message });
  }
};
exports.getAllUsers2 = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      role, 
      isActive,
      filterAuthors // 🟢 Biến mới để điều khiển lọc
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 1. Bộ lọc cơ bản
    let matchQuery = {};
    if (search) {
      matchQuery.$or = [
        { hoTen: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { soDienThoai: { $regex: search, $options: "i" } },
        { maNguoiDung: { $regex: search, $options: "i" } },
      ];
    }
    if (role) matchQuery.role = role;
    if (isActive !== undefined) matchQuery.isActive = isActive === 'true';

    let pipeline = [{ $match: matchQuery }];

    // 🟢 LOGIC CẬP NHẬT: Lọc tác giả có đề thi ĐÃ DUYỆT
    if (filterAuthors === 'true') {
      pipeline.push(
        {
          $lookup: {
            from: "dethis",
            let: { userId: "$_id" }, // Khai báo biến từ collection NguoiDung
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$nguoiDang", "$$userId"] }, // Khớp ID người đăng
                  trangThaiDuyet: true // 🎯 CHỈ LẤY ĐỀ ĐÃ DUYỆT
                }
              }
            ],
            as: "cacDeThiDaDuyet"
          }
        },
        {
          $addFields: { soLuongDe: { $size: "$cacDeThiDaDuyet" } }
        },
        {
          $match: { soLuongDe: { $gte: 1 } } // Chỉ lấy người có ít nhất 1 đề đã duyệt
        }
      );
    }

    // Giấu thông tin nhạy cảm
    pipeline.push({
      $project: { password: 0, maOTP: 0, cacDeThi: 0, currentToken: 0 }
    });

    const allResults = await NguoiDung.aggregate(pipeline);
    const totalUsers = allResults.length;

    const users = await NguoiDung.aggregate([
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    res.status(200).json({
      success: true,
      users,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách", error: error.message });
  }
};
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role, isActive, filterAuthors } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // 1. Bộ lọc cơ bản (Giữ nguyên)
    let matchQuery = {};
    if (search) {
      matchQuery.$or = [
        { hoTen: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { soDienThoai: { $regex: search, $options: "i" } }
      ];
    }
    if (role) matchQuery.role = role;
    if (isActive !== undefined) matchQuery.isActive = isActive === 'true';

    let pipeline = [{ $match: matchQuery }];

    // 🟢 Tối ưu logic lọc tác giả
    if (filterAuthors === 'true') {
      pipeline.push(
        {
          $lookup: {
            from: "dethis",
            localField: "_id",
            foreignField: "nguoiDang",
            pipeline: [
              { $match: { trangThaiDuyet: true } },
              { $project: { _id: 1 } }, // 🚀 CHỈ lấy ID cho nhẹ, không lấy nội dung đề
              { $limit: 1 } // 🚀 Chỉ cần thấy có 1 đề là đủ điều kiện, không cần đếm hết
            ],
            as: "hasQuizzes"
          }
        },
        { $match: { "hasQuizzes.0": { $exists: true } } } // Chỉ lấy người có ít nhất 1 đề
      );
    }

    // 🚀 SỬ DỤNG $FACET ĐỂ ĐẾM VÀ LẤY DATA TRONG 1 LẦN CHẠY DUY NHẤT
    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limitNum },
          { $project: { password: 0, maOTP: 0, currentToken: 0, hasQuizzes: 0 } }
        ]
      }
    });

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
    const user = await NguoiDung.findById(req.params.id).select("-password -maOTP -currentToken")
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error });
  }
};

// 3. Tạo người dùng mới (Dành cho Admin tạo nhân viên)
exports.createUser = async (req, res) => {
  try {
    const { email, password, soDienThoai } = req.body;
    
    // Kiểm tra trùng lặp
    const existingUser = await NguoiDung.findOne({ $or: [{ email }, { soDienThoai }] });
    if (existingUser) return res.status(400).json({ message: "Email hoặc số điện thoại đã tồn tại" });

    // Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new NguoiDung({ ...req.body, password: hashedPassword });
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
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updated = await NguoiDung.findByIdAndUpdate(req.params.id, updateData, { new: true }).select("-password");
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

// 🟢 FOLLOW NGƯỜI KHÁC
exports.followUser = async (req, res) => {
  try {
    const nguoiDuocFollowId = req.params.id; // ID người mình muốn follow
    const nguoiFollowId = req.user._id;      // ID của chính mình (từ Token)

    if (nguoiDuocFollowId === nguoiFollowId.toString()) {
      return res.status(400).json({ message: "Bạn không thể tự theo dõi chính mình." });
    }

    // 1. Kiểm tra đã follow chưa
    const existingFollow = await TheoDoi.findOne({
      nguoiFollow: nguoiFollowId,
      nguoiDuocFollow: nguoiDuocFollowId
    });

    if (existingFollow) {
      return res.status(400).json({ message: "Bạn đã theo dõi người này rồi." });
    }

    // 2. Tạo bản ghi TheoDoi
    await TheoDoi.create({
      nguoiFollow: nguoiFollowId,
      nguoiDuocFollow: nguoiDuocFollowId
    });

    // 3. Cập nhật số lượng cho cả 2 bên
    await Promise.all([
      // Tăng số người đang theo dõi của mình
      NguoiDung.findByIdAndUpdate(nguoiFollowId, { $inc: { soNguoiDangTheoDoi: 1 } }),
      // Tăng số người theo dõi của người kia
      NguoiDung.findByIdAndUpdate(nguoiDuocFollowId, { $inc: { soNguoiTheoDoi: 1 } })
    ]);

    res.status(200).json({ success: true, message: "Đã theo dõi thành công." });
  } catch (error) {
    res.status(500).json({ message: "Lỗi xử lý follow.", error: error.message });
  }
};

// 🔴 BỎ FOLLOW (UNFOLLOW)
exports.unfollowUser = async (req, res) => {
  try {
    const nguoiDuocFollowId = req.params.id;
    const nguoiFollowId = req.user._id;

    // 1. Xóa bản ghi theo dõi
    const result = await TheoDoi.findOneAndDelete({
      nguoiFollow: nguoiFollowId,
      nguoiDuocFollow: nguoiDuocFollowId
    });

    if (!result) {
      return res.status(400).json({ message: "Bạn chưa theo dõi người này." });
    }

    // 2. Giảm số lượng cho cả 2 bên
    await Promise.all([
      NguoiDung.findByIdAndUpdate(nguoiFollowId, { $inc: { soNguoiDangTheoDoi: -1 } }),
      NguoiDung.findByIdAndUpdate(nguoiDuocFollowId, { $inc: { soNguoiTheoDoi: -1 } })
    ]);

    res.status(200).json({ success: true, message: "Đã bỏ theo dõi." });
  } catch (error) {
    res.status(500).json({ message: "Lỗi xử lý unfollow.", error: error.message });
  }
};

// 🔍 KIỂM TRA TRẠNG THÁI FOLLOW
exports.checkFollowStatus = async (req, res) => {
  try {
    const targetUserId = req.params.id; // ID người cần kiểm tra
    const currentUserId = req.user._id; // ID của chính mình (từ Token)

    // Tìm kiếm bản ghi trong bảng trung gian
    const isFollowing = await TheoDoi.findOne({
      nguoiFollow: currentUserId,
      nguoiDuocFollow: targetUserId
    });

    res.status(200).json({
      success: true,
      isFollowing: !!isFollowing // Trả về true nếu tìm thấy, false nếu không
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: "Lỗi kiểm tra trạng thái follow.", 
      error: error.message 
    });
  }
};

// 🟢 LẤY DANH SÁCH NGƯỜI THEO DÕI (Followers)
exports.getFollowers = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const followers = await TheoDoi.find({ nguoiDuocFollow: targetUserId })
      .populate("nguoiFollow").select("-password -maOTP -currentToken")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: followers.map(f => f.nguoiFollow) });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách followers", error: error.message });
  }
};

// 🟢 LẤY DANH SÁCH ĐANG THEO DÕI (Following)
exports.getFollowing = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const following = await TheoDoi.find({ nguoiFollow: targetUserId })
      .populate("nguoiDuocFollow").select("-password -maOTP -currentToken")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: following.map(f => f.nguoiDuocFollow) });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách following" });
  }
};