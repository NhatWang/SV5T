const { buildHocTapPrompt }    = require("./hocTapPrompt");
const { buildTheLucPrompt }    = require("./theLucPrompt");
const { buildTinhNguyenPrompt } = require("./tinhNguyenPrompt");
const { buildHoiNhapPrompt }   = require("./hoiNhapPrompt");
const { buildKhacPrompt }      = require("./khacPrompt");

/**
 * Kiểm tra văn bản có chứa từ khóa "thi thử" không.
 * Dùng để chặn minh chứng mock test cho cấp ĐHQG-HCM.
 */
function containsMockTestKeyword(text) {
  const normalized = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const mockKeywords = [
    "thi thu",
    "ky thi thu",
    "kiem tra thu",
    "chung nhan thu",
    "ket qua thi thu",
    "mock test",
    "practice test",
    "trial test",
    "placement test thu"
  ];

  return mockKeywords.some((keyword) => normalized.includes(keyword));
}

/**
 * Điểm vào duy nhất để lấy prompt theo tiêu chí.
 * Trả về null nếu category không hợp lệ.
 */
function buildPrompt(category, contentDescription, awardLevel = "truong") {
  switch (category) {
    case "hocTapTot":    return buildHocTapPrompt(contentDescription, awardLevel);
    case "theLucTot":    return buildTheLucPrompt(contentDescription, awardLevel);
    case "tinhNguyenTot": return buildTinhNguyenPrompt(contentDescription, awardLevel);
    case "hoiNhapTot":   return buildHoiNhapPrompt(contentDescription, awardLevel);
    case "khac":         return buildKhacPrompt(contentDescription);
    default:             return null;
  }
}

module.exports = { buildPrompt, containsMockTestKeyword };