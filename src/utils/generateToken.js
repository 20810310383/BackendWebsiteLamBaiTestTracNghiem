const jwt = require("jsonwebtoken");

exports.generateToken = (user) => {
  // Xác định số giây (User: 12h, Admin: 24h)
  const seconds = user.role === "admin" ? 24 * 60 * 60 : 12 * 60 * 60; 

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET || "secret_key_here",
    { expiresIn: seconds }
  );

  // 🟢 TÍNH TOÁN MỐC HẾT HẠN GỬI VỀ CHO APP
  const expiresAt = Date.now() + (seconds * 1000); 

  return { token, expiresAt }; // Trả về cả 2
};