const { getAiAwardLevelContext } = require("./context");

function buildTinhNguyenPrompt(contentDescription, awardLevel = "truong") {
  const context = getAiAwardLevelContext(awardLevel);

  return `Đây là minh chứng cho tiêu chí "Tình nguyện tốt" trong chương trình Sinh viên 5 tốt ${context.label}.

Nhiệm vụ:
- Đọc nội dung OCR hoặc mô tả file minh chứng.
- Xác định tài liệu có phù hợp với tiêu chí Tình nguyện tốt của ${context.label} hay không.
- Chỉ đưa ra đề xuất AI. Quyết định cuối cùng thuộc về admin.

LƯU Ý THEO CẤP XÉT:
${context.volunteerNote}

Các nhóm minh chứng thường hợp lệ:
[1] Giấy xác nhận tham gia tình nguyện có thể hiện số ngày tình nguyện.
[2] Giấy chứng nhận tham gia chiến dịch/chương trình tình nguyện phù hợp.
[3] Giấy khen hoặc khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên.
[4] Giấy chứng nhận hiến máu nhân đạo, nếu quy chế/đơn vị xét cho phép quy đổi hoặc tính vào ngày tình nguyện.
[5] Có thể cộng dồn nhiều minh chứng để đạt ít nhất 05 ngày tình nguyện trong năm học.

Quy tắc riêng về số ngày tình nguyện:
- Nếu tài liệu thể hiện từ 05 ngày tình nguyện trở lên, trả isValid = true.
- Nếu tài liệu chỉ thể hiện 1, 2, 3 hoặc 4 ngày tình nguyện nhưng thông tin hợp lệ, trả isValid = null, volunteerDays bằng số ngày xác định được để hệ thống cộng dồn.
- Nếu tài liệu là giấy khen/khen thưởng tình nguyện phù hợp từ cấp Trường trở lên, trả hasVolunteerAward = true và có thể trả isValid = true dù không ghi số ngày.
- Không tự đoán số ngày nếu tài liệu không ghi rõ hoặc không thể suy ra chắc chắn.
- Nếu thiếu ngày, thiếu tên hoạt động, thiếu đơn vị xác nhận hoặc thiếu tên sinh viên, đưa vào missingInfo.

${contentDescription}

Trả lời đúng JSON, không thêm markdown:
{
  "isValid": true hoặc false hoặc null,
  "confidence": số nguyên từ 0 đến 100,
  "matchedType": "loại minh chứng tình nguyện khớp",
  "volunteerDays": số ngày tình nguyện xác định được, nếu không rõ thì 0,
  "volunteerActivityName": "tên hoạt động/chiến dịch nếu có",
  "hasVolunteerAward": true hoặc false,
  "extractedText": "tóm tắt nội dung tài liệu",
  "matchedEvidence": ["điều kiện đã đáp ứng"],
  "missingInfo": ["thông tin còn thiếu hoặc chưa rõ"],
  "reason": "lý do cụ thể bằng tiếng Việt"
}`;
}

module.exports = { buildTinhNguyenPrompt };