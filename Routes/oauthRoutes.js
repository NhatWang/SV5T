const express = require("express");
const Student = require("../Models/Student");
const Admin = require("../Models/Admin");
const { requireStudentAuth, requireAdminAuth } = require("../Middlewares/authMiddleware");
const { createCode } = require("../Utils/oauthStore");

const router = express.Router();

function isAllowedRedirect(uri) {
  const list = (process.env.OAUTH_ALLOWED_REDIRECTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return list.includes(uri);
}

// Gọi sau khi đã đăng nhập sinh viên (có cookie studentToken) — cấp 1 code
// ngắn hạn để redirect về ứng dụng bên thứ 3 (vd Xuân Tình Nguyện).
router.post("/code/student", requireStudentAuth, async (req, res) => {
  try {
    const { redirect_uri } = req.body;

    if (!redirect_uri || !isAllowedRedirect(redirect_uri)) {
      return res.status(400).json({ success: false, message: "redirect_uri không được phép" });
    }

    const student = await Student.findOne({ studentId: req.student.studentId });

    if (!student) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sinh viên" });
    }

    const code = createCode({
      type: "student",
      studentId: student.studentId,
      fullName: student.fullName,
      className: student.className
    });

    res.json({ success: true, code });
  } catch (error) {
    console.error("OAuth code/student error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Tương tự cho admin (có cookie adminToken).
router.post("/code/admin", requireAdminAuth, async (req, res) => {
  try {
    const { redirect_uri } = req.body;

    if (!redirect_uri || !isAllowedRedirect(redirect_uri)) {
      return res.status(400).json({ success: false, message: "redirect_uri không được phép" });
    }

    const admin = await Admin.findOne({ username: req.admin.username });

    if (!admin) {
      return res.status(404).json({ success: false, message: "Không tìm thấy admin" });
    }

    const code = createCode({
      type: "admin",
      username: admin.username,
      role: admin.role,
      className: admin.className
    });

    res.json({ success: true, code });
  } catch (error) {
    console.error("OAuth code/admin error:", error);
    res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

module.exports = router;
