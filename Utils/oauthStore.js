const crypto = require("crypto");

// Lưu tạm authorization code (in-memory) — chỉ dùng được 1 lần, hết hạn sau 60s.
// Đủ dùng vì SV5T chạy 1 instance (pm2 fork mode), không cần Redis/DB cho việc này.
const codes = new Map();
const TTL_MS = 60 * 1000;

function createCode(payload) {
  const code = crypto.randomBytes(24).toString("hex");
  codes.set(code, { payload, expiresAt: Date.now() + TTL_MS });
  return code;
}

function consumeCode(code) {
  const entry = codes.get(code);
  if (!entry) return null;

  codes.delete(code); // single-use

  if (Date.now() > entry.expiresAt) return null;

  return entry.payload;
}

// Dọn rác định kỳ phòng trường hợp code không được dùng tới
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of codes) {
    if (now > entry.expiresAt) codes.delete(code);
  }
}, 5 * 60 * 1000).unref();

module.exports = { createCode, consumeCode };
