const crypto = require("crypto");

function generateResetCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashResetCode(code) {
  return crypto
    .createHash("sha256")
    .update(String(code).trim())
    .digest("hex");
}

function isResetCodeExpired(expiresAt) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() < Date.now();
}

module.exports = {
  generateResetCode,
  hashResetCode,
  isResetCodeExpired
};