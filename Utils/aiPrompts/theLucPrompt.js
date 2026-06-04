const { getAiAwardLevelContext } = require("./context");

function buildTheLucPrompt(contentDescription, awardLevel = "truong") {
  const context = getAiAwardLevelContext(awardLevel);

  return `Đây là minh chứng cho tiêu chí "Thể lực tốt" trong chương trình Sinh viên 5 tốt ${context.label}.

Nhiệm vụ:
- Đọc nội dung OCR hoặc mô tả file minh chứng.
- Xác định tài liệu có phù hợp với tiêu chí Thể lực tốt của ${context.label} hay không.
- Chỉ đưa ra đề xuất AI. Quyết định cuối cùng thuộc về admin.

LƯU Ý THEO CẤP XÉT:
${context.theLucNote}

Các nhóm minh chứng thường hợp lệ:
[1] Giấy chứng nhận đạt danh hiệu "Thanh niên khỏe" từ cấp Trường trở lên.
[2] Giấy chứng nhận hoặc huy chương tham gia/đạt giải hoạt động thể thao phù hợp theo cấp xét hiện tại.
[3] Minh chứng là thành viên chính thức đội tuyển thể thao theo cấp xét hiện tại.
[4] Với cấp Trường, có thể chấp nhận minh chứng tham gia CLB/thể thao/rèn luyện thể thao đủ điều kiện thời lượng theo quy chế trường.
[5] Không tính giải thể thao điện tử.

Quy tắc riêng cho AI:
- Nếu minh chứng không ghi rõ cấp tổ chức, thời gian, tên sinh viên hoặc loại hoạt động thể thao, đưa vào missingInfo.
- Không tự suy đoán cấp tổ chức hoặc thời lượng tập luyện nếu tài liệu không nêu rõ.
- Với cấp cao hơn, nếu minh chứng chỉ thể hiện hoạt động nội bộ cấp thấp và không đủ căn cứ theo quy chế, trả isValid = null hoặc false và yêu cầu admin kiểm tra.

${contentDescription}

Trả lời đúng JSON, không thêm markdown:
{
  "isValid": true hoặc false hoặc null,
  "confidence": số nguyên từ 0 đến 100,
  "matchedType": "loại minh chứng thể lực khớp",
  "extractedText": "tóm tắt nội dung tài liệu",
  "matchedEvidence": ["điều kiện đã đáp ứng"],
  "missingInfo": ["thông tin còn thiếu hoặc chưa rõ"],
  "reason": "lý do cụ thể bằng tiếng Việt"
}`;
}

module.exports = { buildTheLucPrompt };