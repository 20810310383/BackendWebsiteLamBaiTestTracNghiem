module.exports = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Chưa xác thực người dùng" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Bạn không có quyền thực hiện chức năng này",
    });
  }

   if (req.user.isActive !== true) {
    return res.status(403).json({
      message: "Tài khoản bạn bị khoá! Liên hệ admin để được hỗ trợ.",
    });
  }

  next();
};
