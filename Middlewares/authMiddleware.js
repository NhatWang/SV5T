const jwt = require("jsonwebtoken");

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// Sinh viên phải đăng nhập
function requireStudentAuth(req, res, next) {
  try {
    const token = req.cookies.studentToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập sinh viên"
      });
    }

    const decoded = verifyToken(token);

    if (decoded.type !== "student") {
      return res.status(403).json({
        success: false,
        message: "Token không hợp lệ cho sinh viên"
      });
    }

    req.student = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Phiên đăng nhập sinh viên không hợp lệ hoặc đã hết hạn"
    });
  }
}

// Admin hoặc super_admin phải đăng nhập
function requireAdminAuth(req, res, next) {
  try {
    const token = req.cookies.adminToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập admin"
      });
    }

    const decoded = verifyToken(token);

    if (decoded.type !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Token không hợp lệ cho admin"
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Phiên đăng nhập admin không hợp lệ hoặc đã hết hạn"
    });
  }
}

// Chỉ super_admin
function requireSuperAdmin(req, res, next) {
  if (!req.admin || req.admin.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền super admin"
    });
  }

  next();
}

// Admin chi Hội chỉ được xem chi Hội của mình, super_admin được xem tất cả
function requireClassPermission(req, res, next) {
  const { className } = req.params;

  if (!req.admin) {
    return res.status(401).json({
      success: false,
      message: "Bạn chưa đăng nhập admin"
    });
  }

  if (req.admin.role === "super_admin") {
    return next();
  }

  if (req.admin.role === "admin" && req.admin.className === className) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Bạn không có quyền xem chi Hội này"
  });
}

module.exports = {
  requireStudentAuth,
  requireAdminAuth,
  requireSuperAdmin,
  requireClassPermission
};