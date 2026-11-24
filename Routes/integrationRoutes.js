const express = require("express");
const bcrypt = require("bcryptjs");
const Student = require("../Models/Student");
const Admin = require("../Models/Admin");

const router = express.Router();

// ===============================
// Middleware: chỉ cho phép server-to-server có đúng secret key
// ===============================
function requireIntegrationKey(req, res, next) {
  const key = req.headers["x-integration-key"];

  if (!process.env.INTEGRATION_SECRET || key !== process.env.INTEGRATION_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized integration request" });
  }

  next();
}

// ===============================
// POST /api/integration/verify-student
// Dùng cho hệ thống khác (vd Xuân Tình Nguyện) xác thực đăng nhập
// bằng tài khoản SV5T và lấy thông tin sinh viên.
// ===============================
router.post("/verify-student", requireIntegrationKey, async (req, res) => {
  try {
    const { studentId, password } = req.body;

    if (!studentId || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập MSSV và mật khẩu"
      });
    }

    const student = await Student.findOne({ studentId: studentId.trim() });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên"
      });
    }

    if (!student.password) {
      return res.status(400).json({
        success: false,
        message: "Tài khoản SV5T chưa tạo mật khẩu"
      });
    }

    const isMatch = await bcrypt.compare(password, student.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Sai mật khẩu"
      });
    }

    res.json({
      success: true,
      student: {
        studentId: student.studentId,
        fullName: student.fullName,
        className: student.className
      }
    });
  } catch (error) {
    console.error("Integration verify-student error:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi xác thực" });
  }
});

// ===============================
// POST /api/integration/verify-admin
// Dùng cho hệ thống khác xác thực đăng nhập bằng tài khoản Admin SV5T.
// ===============================
router.post("/verify-admin", requireIntegrationKey, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập username và mật khẩu"
      });
    }

    const admin = await Admin.findOne({ username: username.trim() });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy admin"
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Sai mật khẩu"
      });
    }

    res.json({
      success: true,
      admin: {
        username: admin.username,
        role: admin.role,
        className: admin.className
      }
    });
  } catch (error) {
    console.error("Integration verify-admin error:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi xác thực" });
  }
});

module.exports = router;
