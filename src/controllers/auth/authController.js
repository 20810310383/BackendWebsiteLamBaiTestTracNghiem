const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { generateToken } = require("../../utils/generateToken");
const NguoiDung = require("../../models/NguoiDung");
const nodemailer = require("nodemailer");
const OtpStorage = require("../../models/OtpStorage");
require("dotenv").config();
const crypto = require("crypto");

// 1️⃣ Cấu hình gửi mail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 📌 Đăng ký tài khoản
exports.registerTK = async (req, res) => {
  try {
    const { email, so_dien_thoai, ho_ten, mat_khau, ma_so } = req.body;

    if (!email || !mat_khau) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
    }

    // Kiểm tra trùng email
    const existedEmail = await NguoiDung.findOne({ email });
    if (existedEmail) {
      // Nếu tài khoản đã tồn tại VÀ đã kích hoạt thì mới chặn
      if (existedEmail.isActive) {
        return res.status(400).json({ 
          message: "Email này đã được đăng ký. Vui lòng chọn email khác!" 
        });
      }
      // Nếu tồn tại nhưng isActive là false -> Tiếp tục luồng bên dưới để gửi lại OTP
      console.log("Tài khoản chưa kích hoạt, chuẩn bị gửi lại OTP...");
    }

    // 2. Kiểm tra trùng số điện thoại (tương tự logic email)
    if (so_dien_thoai) {
      const existedPhone = await NguoiDung.findOne({ so_dien_thoai });
      if (existedPhone && existedPhone.isActive) {
        return res.status(400).json({ 
          message: "Số điện thoại này đã được đăng ký. Vui lòng chọn số điện thoại khác!" 
        });
      }
    }

    if (ma_so) {
      const existedPhone = await NguoiDung.findOne({ ma_so });
      if (existedPhone && existedPhone.isActive) {
        return res.status(400).json({ 
          message: "Mã sinh viên này đã được đăng ký. Vui lòng chọn Mã sinh viên khác!" 
        });
      }
    }

    // Tạo mã OTP 6 số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Lưu OTP vào bảng tạm (upsert: true để cập nhật nếu gửi lại mã)
    await OtpStorage.findOneAndUpdate({ email }, { otp }, { upsert: true });

    
    // Gửi Mail
    const mailOptions = {
      from: "HỆ THỐNG",
      to: email,
      subject: "MÃ XÁC THỰC ĐĂNG KÝ TÀI KHOẢN",
      html: `
  <div style="background-color: #0f172a; padding: 40px 20px; font-family: 'Segoe UI', Arial, sans-serif; color: #ffffff; text-align: center;">
    <div style="max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #34d399; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
      
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px;">
        <p style="margin-top: 5px; opacity: 0.9; font-size: 14px;">Hệ thống luyện thi hàng đầu</p>
      </div>

      <div style="padding: 40px 30px;">
        <h2 style="color: #ffffff; margin-bottom: 20px; font-size: 22px;">Xác thực tài khoản</h2>
        <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">
          Chào mừng bạn gia nhập cộng đồng! Hãy sử dụng mã OTP dưới đây để hoàn tất đăng ký:
        </p>
        
        <div style="margin: 30px 0; padding: 20px; background: rgba(16, 185, 129, 0.1); border: 1px dashed #10b981; border-radius: 12px;">
          <span style="font-size: 42px; font-weight: 800; color: #10b981; letter-spacing: 10px; display: block;">${otp}</span>
        </div>

        <p style="color: #ef4444; font-size: 14px; font-weight: 500;">
          ⚠️ Mã có hiệu lực trong 5 phút.
        </p>
      </div>

      <div style="padding: 20px; background: #0f172a; border-top: 1px solid #334155;">
        <p style="margin: 0; color: #64748b; font-size: 12px;">
          Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.<br>
          © 2026 Team - Nâng tầm trí tuệ Việt.
        </p>
      </div>
    </div>
  </div>
`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      success: true, 
      message: "Thông tin hợp lệ. Mã OTP đã được gửi về email!" 
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// 📌 API 2: Xác thực OTP & Chính thức lưu vào Database
exports.xacThucOTPAndRegister = async (req, res) => {
  try {
    const { email, otp, ho_ten, so_dien_thoai, mat_khau, ma_so } = req.body;

    // 1. Kiểm tra mã OTP trong bảng tạm
    const record = await OtpStorage.findOne({ email, otp });
    if (!record) {
      return res.status(400).json({ success: false, message: "Mã OTP không chính xác hoặc đã hết hạn" });
    }

    // 2. Hash mật khẩu và lưu chính thức
    const hashedPassword = await bcrypt.hash(mat_khau, 10);

   // 3. XỬ LÝ LƯU USER (Khắc phục lỗi Duplicate Key)
    let user = await NguoiDung.findOne({ email });

    if (user) {
      // TRƯỜNG HỢP 1: User đã tồn tại (isActive: false) -> Cập nhật thông tin và kích hoạt
      user.ho_ten = ho_ten;
      user.ma_so = ma_so;
      user.so_dien_thoai = so_dien_thoai;
      user.mat_khau = hashedPassword;
      user.isActive = true; // Kích hoạt tài khoản
      await user.save();
    } else {
      // TRƯỜNG HỢP 2: User hoàn toàn mới -> Tạo mới
      user = new NguoiDung({
        ma_so,
        email,
        so_dien_thoai,
        ho_ten,
        mat_khau: hashedPassword,
        isActive: true
      });
      await user.save();
    }

    // 4. Xóa mã OTP sau khi dùng xong
    await OtpStorage.deleteOne({ email });

    const token = generateToken(user);

    res.status(201).json({
      message: "Xác thực và Đăng ký thành công",
      user: {
        id: user._id,
        email: user.email,
        ho_ten: user.ho_ten,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Lỗi xác thực & đăng ký:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// 📌 Đăng nhập
exports.loginTK = async (req, res) => {
  try {
    const { taiKhoan, password } = req.body;

    // 1️⃣ Validate input
    if (!taiKhoan || !password) {
      return res.status(400).json({
        message: "Vui lòng nhập Email, Số điện thoại hoặc Mã số và mật khẩu",
      });
    }

    // 2️⃣ Tìm user (Email / SĐT / Mã Số) + lấy mật khẩu
    // select("+mat_khau") vì thường mật khẩu sẽ để select: false trong schema để bảo mật
    const user = await NguoiDung.findOne({
      $or: [
        { email: taiKhoan },
        { so_dien_thoai: taiKhoan },
        { ma_so: taiKhoan }
      ]
    }).select("+mat_khau");

    // 3️⃣ Check user tồn tại
    if (!user) {
      return res.status(404).json({
        message: "Tài khoản không tồn tại trên hệ thống",
      });
    }

    // 4️⃣ Check active (Dựa theo field isActive của Tú)
    if (!user.isActive) {
      return res.status(403).json({
        message: "Tài khoản chưa được kích hoạt hoặc bị khóa. Liên hệ admin!",
      });
    }

    // 5️⃣ So sánh mật khẩu (Lưu ý: dùng user.mat_khau cho khớp Model)
    const isMatch = await bcrypt.compare(password, user.mat_khau);
    if (!isMatch) {
      return res.status(400).json({
        message: "Mật khẩu không chính xác",
      });
    }

    // 6️⃣ Tạo token
    const { token, expiresAt } = generateToken(user);
    user.currentToken = token;
    await user.save();

    res.status(200).json({
      message: "Đăng nhập thành công",
      user: {
        id: user._id,
        ma_so: user.ma_so,
        email: user.email,
        so_dien_thoai: user.so_dien_thoai,
        ho_ten: user.ho_ten,
        role: user.role,
        anh_dai_dien: user.anh_dai_dien,
        ten_lop_sinh_hoat: user.ten_lop_sinh_hoat,
        soDu: user.soDu
      },
      token,
      expiresAt, 
    });

  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};



// 📌 Đăng xuất
exports.logoutTK = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    await NguoiDung.findByIdAndUpdate(decoded.id, { $unset: { currentToken: "" } });

    res.status(200).json({ message: "Đăng xuất thành công" });
  } catch (error) {
    res.status(400).json({ message: "Lỗi khi đăng xuất", error: error.message });
  }
};


// 📌 Lấy thông tin user hiện tại (sau khi login)
exports.getMeTK = async (req, res) => {
  try {  
    const user = await NguoiDung.findById(req.user._id).select("-mat_khau -currentToken"); // loại bỏ trường mật khẩu và currentToken khi trả về
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.doiMatKhau = async (req, res) => {
  try {
    const { matKhauCu, matKhauMoi } = req.body;
    console.log("req.user._id: ",req.user._id);
    

    if (!matKhauCu || !matKhauMoi)
      return res
        .status(400)
        .json({ success: false, message: "Thiếu mật khẩu cũ hoặc mới" });

    const user = await NguoiDung.findById(req.user._id)
    if (!user)
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });

    // ✅ Kiểm tra mật khẩu cũ
    const isMatch = await bcrypt.compare(matKhauCu, user.mat_khau);
    if (!isMatch)
      return res
        .status(400)
        .json({ success: false, message: "Mật khẩu cũ không đúng" });

    // ✅ Hash mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(matKhauMoi, salt);

    user.mat_khau = hashed;
    await user.save();

    res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (err) {
    console.error("Lỗi đổi mật khẩu:", err);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

exports.capNhatThongTin = async (req, res) => {
  try {
    // 1️⃣ Lấy các trường từ body theo đúng chuẩn snake_case của Model
    const { ho_ten, so_dien_thoai, anh_dai_dien, ten_lop_sinh_hoat, gioiThieu} = req.body;

    // 2️⃣ Tìm người dùng từ ID (lấy từ middleware verifyToken/protect)
    const user = await NguoiDung.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy người dùng trên hệ thống" 
      });
    }

    // 3️⃣ Cập nhật các trường cho phép (Sửa key cho khớp Model)
    // Dùng check !== undefined để cho phép cập nhật chuỗi rỗng nếu cần
    if (ho_ten !== undefined) user.ho_ten = ho_ten;
    if (so_dien_thoai !== undefined) user.so_dien_thoai = so_dien_thoai;
    if (anh_dai_dien !== undefined) user.anh_dai_dien = anh_dai_dien;
    if (ten_lop_sinh_hoat !== undefined) user.ten_lop_sinh_hoat = ten_lop_sinh_hoat;
    if (gioiThieu !== undefined) user.gioiThieu = gioiThieu;

    // Lưu lại vào MongoDB
    await user.save();

    // 4️⃣ Trả về dữ liệu sạch (không bao gồm các trường nhạy cảm)
    res.json({
      success: true,
      message: "Cập nhật thông tin thành công",
      data: {
        id: user._id,
        ma_so: user.ma_so,
        ho_ten: user.ho_ten,
        email: user.email,
        so_dien_thoai: user.so_dien_thoai,
        anh_dai_dien: user.anh_dai_dien,
        ten_lop_sinh_hoat: user.ten_lop_sinh_hoat,
        gioiThieu: user.gioiThieu,
        role: user.role
      }
    });

  } catch (err) {
    console.error("Lỗi cập nhật thông tin:", err);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server trong quá trình cập nhật" 
    });
  }
};

// 📌 API: Quên mật khẩu - Gửi mật khẩu mới về Email
exports.quenMatKhau = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Kiểm tra input
    if (!email) {
      return res.status(400).json({ message: "Vui lòng nhập email" });
    }

    // 2. Tìm người dùng theo email
    const user = await NguoiDung.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "Email không tồn tại trong hệ thống" });
    }

    // 3. Kiểm tra trạng thái tài khoản (isActive)
    if (!user.isActive) {
      return res.status(403).json({
        message: "Tài khoản của bạn đang bị khóa. Vui lòng liên hệ Admin!",
      });
    }

    // 4. Tạo mật khẩu ngẫu nhiên mới (Ví dụ: 8 ký tự)
    const newPassword = crypto.randomBytes(4).toString("hex"); // Ví dụ: "a1b2c3d4"
    
    // 5. Hash mật khẩu mới và lưu vào DB
    const salt = await bcrypt.genSalt(10);
    user.mat_khau = await bcrypt.hash(newPassword, salt);
    await user.save();

    // 6. Cấu hình nội dung Email
   const mailOptions = {
  from: 'Admin System', // Để format này nhìn chuyên nghiệp hơn
  to: email,
  subject: "🔐 KHÔI PHỤC MẬT KHẨU TÀI KHOẢN",
  html: `
    <div style="background-color: #0f172a; padding: 40px 20px; font-family: 'Segoe UI', Arial, sans-serif; color: #ffffff;">
      <div style="max-width: 550px; margin: 0 auto; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #34d399; box-shadow: 0 15px 35px rgba(0,0,0,0.4);">
        
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 10px;">🔐</div>
          <h1 style="margin: 0; font-size: 24px; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">Khôi phục mật khẩu</h1>
        </div>

        <div style="padding: 40px 30px; text-align: center;">
          <h2 style="color: #ffffff; margin-bottom: 20px;">Chào ${user.hoTen}!</h2>
          <p style="color: #94a3b8; line-height: 1.6; font-size: 16px;">
            Đừng lo lắng, chúng tôi đã cấp lại mật khẩu tạm thời cho bạn. Hãy sử dụng thông tin dưới đây để truy cập lại hệ thống:
          </p>
          
          <div style="margin: 30px 0; padding: 25px; background: #0f172a; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.3);">
            <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px; text-transform: uppercase;">Mật khẩu mới của bạn</p>
            <b style="font-size: 32px; color: #f43f5e; letter-spacing: 1px; font-family: 'Courier New', Courier, monospace;">${newPassword}</b>
          </div>

          <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 25px; text-align: left;">
            <p style="margin: 0; color: #fbbf24; font-size: 14px;">
              <strong>💡 Lời khuyên bảo mật:</strong> Sau khi đăng nhập thành công, bạn hãy vào phần <b>Cài đặt tài khoản</b> để đổi lại mật khẩu cá nhân ngay nhé.
            </p>
          </div>       
        </div>

        <div style="padding: 20px; background: #0f172a; border-top: 1px solid #334155; text-align: center;">
          <p style="margin: 0; color: #64748b; font-size: 12px;">
            Nếu bạn không yêu cầu hành động này, hãy liên hệ với chúng tôi để bảo vệ tài khoản.<br>
            © 2026 Team - Kiến thức là sức mạnh.
          </p>
        </div>
      </div>
    </div>
  `,
};

    // 7. Thực hiện gửi mail
    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: "Mật khẩu mới đã được gửi về email của bạn!",
    });

  } catch (error) {
    console.error("Lỗi quên mật khẩu:", error);
    res.status(500).json({ message: "Lỗi server khi khôi phục mật khẩu" });
  }
};