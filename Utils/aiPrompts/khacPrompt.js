function buildKhacPrompt(contentDescription) {
  return `Đây là minh chứng thuộc tab "Khác" trong hồ sơ Sinh viên 5 tốt cấp Trường.

Nhiệm vụ:
- Đọc nội dung OCR hoặc mô tả file minh chứng.
- Chỉ xác định các giấy chứng nhận hoặc bằng khen liên quan trực tiếp đến danh hiệu "Sinh viên 5 tốt" ở các năm trước.
- Không dùng minh chứng này để hoàn thành 5 tiêu chí chính.
- Chỉ đưa ra đề xuất AI. Quyết định cuối cùng thuộc về admin.

CHỈ CHẤP NHẬN các loại minh chứng sau:
[1] Giấy chứng nhận đạt danh hiệu Sinh viên 5 tốt cấp Khoa trong các năm trước.
[2] Giấy chứng nhận đạt danh hiệu Sinh viên 5 tốt cấp Trường trong các năm trước.
[3] Giấy chứng nhận đạt danh hiệu Sinh viên 5 tốt cấp ĐHQG-HCM.
[4] Giấy chứng nhận đạt danh hiệu Sinh viên 5 tốt cấp Thành phố.
[5] Giấy chứng nhận đạt danh hiệu Sinh viên 5 tốt cấp Trung ương.
[6] Minh chứng thể hiện sinh viên đạt Sinh viên 5 tốt cấp Khoa hoặc cấp Trường 2 năm liền.
[7] Minh chứng thể hiện sinh viên đạt Sinh viên 5 tốt cấp Khoa hoặc cấp Trường 3 năm liền.
[8] Bằng khen của Giám đốc ĐHQG-HCM cho Sinh viên 5 tốt tiêu biểu.

KHÔNG CHẤP NHẬN:
- Giấy chứng nhận tham gia hoạt động thông thường.
- Giấy chứng nhận tình nguyện, thể thao, học thuật, kỹ năng, hội nhập nếu không ghi rõ đạt danh hiệu Sinh viên 5 tốt.
- Bảng điểm, chứng chỉ ngoại ngữ, giấy xác nhận hoạt động đơn lẻ.
- Giấy chứng nhận không có cụm "Sinh viên 5 tốt".
- Minh chứng không liên quan đến danh hiệu Sinh viên 5 tốt.

Quy tắc phân loại:
- Nếu có "Sinh viên 5 tốt" và "cấp Khoa" và "2 năm liền", matchedType = "sv5t_khoa_2_nam_lien", sv5tHistoryLevel = "khoa", consecutiveYears = 2.
- Nếu có "Sinh viên 5 tốt" và "cấp Khoa" và "3 năm liền", matchedType = "sv5t_khoa_3_nam_lien", sv5tHistoryLevel = "khoa", consecutiveYears = 3.
- Nếu có "Sinh viên 5 tốt" và "cấp Trường" và "2 năm liền", matchedType = "sv5t_truong_2_nam_lien", sv5tHistoryLevel = "truong", consecutiveYears = 2.
- Nếu có "Sinh viên 5 tốt" và "cấp Trường" và "3 năm liền", matchedType = "sv5t_truong_3_nam_lien", sv5tHistoryLevel = "truong", consecutiveYears = 3.
- Nếu chỉ thể hiện đạt Sinh viên 5 tốt cấp Khoa, matchedType = "sv5t_khoa", sv5tHistoryLevel = "khoa".
- Nếu chỉ thể hiện đạt Sinh viên 5 tốt cấp Trường, matchedType = "sv5t_truong", sv5tHistoryLevel = "truong".
- Nếu thể hiện đạt Sinh viên 5 tốt cấp ĐHQG-HCM, matchedType = "sv5t_dhqg", sv5tHistoryLevel = "dhqg".
- Nếu thể hiện đạt Sinh viên 5 tốt cấp Thành phố, matchedType = "sv5t_thanh", sv5tHistoryLevel = "thanh".
- Nếu thể hiện đạt Sinh viên 5 tốt cấp Trung ương, matchedType = "sv5t_trung_uong", sv5tHistoryLevel = "trung_uong".
- Nếu có "Giám đốc ĐHQG" hoặc "Giám đốc Đại học Quốc gia" và "Sinh viên 5 tốt tiêu biểu", matchedType = "bang_khen_giam_doc_dhqg_sv5t_tieu_bieu", sv5tHistoryLevel = "dhqg".
- Nếu không thấy rõ cụm "Sinh viên 5 tốt" hoặc không phải giấy chứng nhận/bằng khen SV5T, trả isValid = false, matchedType = "unknown".

${contentDescription}

Trả lời đúng JSON, không thêm markdown:
{
  "isValid": true hoặc false hoặc null,
  "confidence": số nguyên từ 0 đến 100,
  "matchedType": "sv5t_khoa hoặc sv5t_truong hoặc sv5t_khoa_2_nam_lien hoặc sv5t_khoa_3_nam_lien hoặc sv5t_truong_2_nam_lien hoặc sv5t_truong_3_nam_lien hoặc sv5t_dhqg hoặc sv5t_thanh hoặc sv5t_trung_uong hoặc bang_khen_giam_doc_dhqg_sv5t_tieu_bieu hoặc unknown",
  "sv5tHistoryType": "giống matchedType",
  "sv5tHistoryLevel": "khoa hoặc truong hoặc dhqg hoặc thanh hoặc trung_uong hoặc unknown",
  "sv5tHistoryYears": ["2023", "2024"],
  "consecutiveYears": 0 hoặc 2 hoặc 3,
  "issuer": "đơn vị cấp giấy chứng nhận hoặc bằng khen nếu có",
  "awardTitle": "tên giấy chứng nhận hoặc bằng khen nếu có",
  "extractedText": "tóm tắt nội dung OCR quan trọng",
  "matchedEvidence": ["các cụm từ trong văn bản giúp xác định"],
  "missingInfo": ["thông tin còn thiếu nếu chưa đủ"],
  "reason": "giải thích ngắn gọn bằng tiếng Việt"
}`;
}

module.exports = { buildKhacPrompt };