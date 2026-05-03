/**
 * Middleware kiểm tra xác thực - Yêu cầu đã đăng nhập
 */
const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      message: "Vui lòng đăng nhập để tiếp tục"
    });
  }
  next();
};

/**
 * Middleware kiểm tra quyền theo vai trò
 * @param {string[]} allowedRoles - Mảng các vai trò được phép truy cập
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: "Vui lòng đăng nhập để tiếp tục"
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập trang này"
      });
    }

    next();
  };
};

/**
 * Middleware kiểm tra tài khoản đang hoạt động
 */
const requireActive = (req, res, next) => {
  if (!req.user || !req.user.trang_thai_hoat_dong) {
    return res.status(403).json({
      success: false,
      message: "Tài khoản của bạn đã bị vô hiệu hóa"
    });
  }
  next();
};

/**
 * Middleware kiểm tra tài khoản đã kích hoạt (email/OTP verified)
 */
const requireVerified = (req, res, next) => {
  if (!req.user || !req.user.isActive) {
    return res.status(403).json({
      success: false,
      message: "Vui lòng xác thực tài khoản trước khi sử dụng"
    });
  }
  next();
};

/**
 * Kiểm tra quyền sở hữu hoặc quyền admin
 */
const requireOwnerOrAdmin = (req, res, next) => {
  const resourceUserId = req.params.id || req.body.id || req.params.userId;
  const currentUserId = req.user.id;
  const currentRole = req.user.role;

  // Admin có quyền truy cập tất cả
  if (currentRole === 'admin') {
    return next();
  }

  // Kiểm tra quyền sở hữu
  if (resourceUserId && resourceUserId.toString() === currentUserId.toString()) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Bạn không có quyền thực hiện thao tác này"
  });
};

module.exports = {
  requireAuth,
  requireRole,
  requireActive,
  requireVerified,
  requireOwnerOrAdmin
};
