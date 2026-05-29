const express = require("express");
const bcrypt = require("bcryptjs");
const Admin = require("../Models/Admin");
const jwt = require("jsonwebtoken");

const router = express.Router();

// POST /api/admin/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập tài khoản và mật khẩu"
      });
    }

    const admin = await Admin.findOne({
      username: username.trim()
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản admin"
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Sai mật khẩu"
      });
    }

    const token = createAdminToken(admin);
      setAdminCookie(res, token);

    res.json({
      success: true,
      message: "Đăng nhập admin thành công",
      admin: {
        username: admin.username,
        role: admin.role,
        className: admin.className || ""
      }
    });
  } catch (error) {
    console.error("Admin login error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi đăng nhập admin"
    });
  }
});

function createAdminToken(admin) {
  return jwt.sign(
    {
      type: "admin",
      username: admin.username,
      role: admin.role,
      className: admin.className || ""
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d"
    }
  );
}

function setAdminCookie(res, token) {
  res.cookie("adminToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000
  });
}

router.get("/me", (req, res) => {
  try {
    const token = req.cookies.adminToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập admin"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Token không hợp lệ"
      });
    }

    res.json({
      success: true,
      admin: {
        username: decoded.username,
        role: decoded.role,
        className: decoded.className || ""
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Phiên đăng nhập admin không hợp lệ hoặc đã hết hạn"
    });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("adminToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  });

  res.json({
    success: true,
    message: "Đăng xuất admin thành công"
  });
});

module.exports = router;