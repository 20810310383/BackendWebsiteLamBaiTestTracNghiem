/**
 * Middleware kiểm tra quyền truy cập dựa trên Role
 * @param {Array} roles - Danh sách các role được phép (vd: ['admin', 'giaovien'])
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    // req.user được thiết lập từ middleware verifyToken trước đó
    if (!req.user) {
      return res.status(401).json({ 
        message: "Không tìm thấy thông tin xác thực. Vui lòng đăng nhập lại." 
      });
    }

    // Kiểm tra xem role của người dùng có nằm trong danh sách cho phép không
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Truy cập bị từ chối. Hành động này chỉ dành cho: ${roles.join(', ')}.` 
      });
    }

    next(); // Hợp lệ thì cho đi tiếp
  };
};

module.exports = { checkRole };