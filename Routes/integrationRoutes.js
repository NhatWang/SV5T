const express = require("express");
const { consumeCode } = require("../Utils/oauthStore");

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
// POST /api/integration/oauth/token
// Đổi authorization code (lấy từ /api/oauth/code/*) ra thông tin tài khoản.
// Dùng cho hệ thống khác (vd Xuân Tình Nguyện) đăng nhập hộ qua SV5T kiểu
// "Đăng nhập bằng Google/Zalo" — không bao giờ nhận mật khẩu trực tiếp.
// Code dùng 1 lần, hết hạn sau 60s.
// ===============================
router.post("/oauth/token", requireIntegrationKey, (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, message: "Thiếu code" });
  }

  const payload = consumeCode(code);

  if (!payload) {
    return res.status(400).json({ success: false, message: "Code không hợp lệ hoặc đã hết hạn" });
  }

  res.json({ success: true, ...payload });
});

module.exports = router;
