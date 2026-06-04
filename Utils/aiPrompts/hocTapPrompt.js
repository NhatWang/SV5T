const { isHigherAwardLevel } = require("../sv5tLevels");
const { getAiAwardLevelContext } = require("./context");

function buildHocTapPrompt(contentDescription, awardLevel = "truong") {
  const context = getAiAwardLevelContext(awardLevel);
  const isHigherLevel = isHigherAwardLevel(awardLevel);

  if (isHigherLevel) {
    return `Đây là minh chứng cho phần "Tiêu chuẩn khác" của tiêu chí "Học tập tốt" trong chương trình Sinh viên 5 tốt ${context.label}.

Nhiệm vụ:
- Đọc nội dung OCR hoặc mô tả file minh chứng.
- Xác định tài liệu có thuộc ít nhất 01 nhóm minh chứng học thuật hợp lệ cho ${context.label} hay không.
- Chỉ đưa ra đề xuất AI. Quyết định cuối cùng thuộc về admin.

LƯU Ý QUAN TRỌNG:
${context.hocTapNote}

Tiêu chí "Học tập tốt" gồm 2 phần:
A. Tiêu chuẩn bắt buộc: GPA, không nợ môn/học phần/tín chỉ, không gian lận trong thi cử, thái độ học tập đúng đắn.
B. Tiêu chuẩn khác: đạt ít nhất 01 trong các nhóm minh chứng học thuật hợp lệ dưới đây.

Tài liệu này chỉ dùng để AI hỗ trợ phân tích phần B - Tiêu chuẩn khác.

Các nhóm minh chứng hợp lệ cho phần "Tiêu chuẩn khác" của ${context.label}:
[1] Có đề tài nghiên cứu khoa học sinh viên hoặc khóa luận tốt nghiệp trong năm học được nghiệm thu đạt yêu cầu theo quy chế cấp xét hiện tại, hoặc đạt giải theo cấp quy định.
[2] Đạt giải trong cuộc thi học thuật, cuộc thi ý tưởng sáng tạo hoặc giải thưởng nghiên cứu khoa học theo cấp/mức giải quy định.
[3] Có bài viết đăng trên tạp chí chuyên ngành hoặc bài tham luận tham gia hội thảo khoa học theo cấp quy định.
[4] Có sản phẩm sáng tạo, giải pháp hữu ích, bằng sáng chế, đơn đăng ký chứng nhận quyền sở hữu trí tuệ hoặc giấy phép xuất bản.
[5] Là thành viên đội tuyển tham gia cuộc thi học thuật cấp quốc gia hoặc quốc tế.
[6] Với cấp Thành phố, có thể tính thành tích nổi bật của sinh viên khối ngành năng khiếu trong cuộc thi cấp Thành, cấp Quốc gia, khu vực trở lên hoặc tác phẩm tham gia triển lãm chuyên ngành cấp Thành trở lên nếu minh chứng thể hiện rõ.

Quy tắc riêng cho AI:
- KHÔNG yêu cầu đủ 03 hoạt động học thuật đối với ${context.label}.
- Nếu tài liệu chỉ là giấy xác nhận tham gia 01 hoạt động học thuật thông thường và không thể hiện giải thưởng, nghiên cứu, bài báo, hội thảo, sản phẩm sáng tạo hoặc đội tuyển học thuật, hãy trả isValid = null hoặc false tùy độ rõ, và yêu cầu admin kiểm tra.
- Nếu tài liệu thuộc nhóm nghiên cứu khoa học, khóa luận, giải thưởng học thuật, bài báo, hội thảo, sản phẩm sáng tạo, bằng sáng chế, sở hữu trí tuệ hoặc đội tuyển học thuật thì có thể xem là minh chứng trực tiếp.
- Nếu thiếu cấp tổ chức, thiếu kết quả giải, thiếu điểm nghiệm thu, thiếu loại xếp loại, thiếu xác nhận hoặc thiếu tên sinh viên thì đưa vào missingInfo.
- Không tự suy đoán cấp tổ chức hoặc thành tích nếu file không thể hiện rõ.

${contentDescription}

Trả lời đúng JSON, không thêm markdown:
{
  "isValid": true hoặc false hoặc null,
  "confidence": số nguyên từ 0 đến 100,
  "matchedType": "loại minh chứng học tập khớp",
  "academicEvidenceType": "nghienCuu hoặc sangTao hoặc baiBao hoặc doiTuyen hoặc khac_direct hoặc chuỗi rỗng",
  "academicActivityCount": 0,
  "extractedText": "tóm tắt nội dung tài liệu",
  "matchedEvidence": ["điều kiện đã đáp ứng"],
  "missingInfo": ["thông tin còn thiếu nếu có"],
  "reason": "lý do cụ thể bằng tiếng Việt"
}`;
  }

  return `Đây là minh chứng cho phần "Tiêu chuẩn khác" của tiêu chí "Học tập tốt" trong chương trình Sinh viên 5 tốt ${context.label}.

Nhiệm vụ:
- Đọc nội dung OCR hoặc mô tả file minh chứng.
- Xác định tài liệu có phù hợp với phần "Tiêu chuẩn khác" của Học tập tốt cấp Trường hay không.
- Chỉ đưa ra đề xuất AI. Quyết định cuối cùng thuộc về admin.

LƯU Ý QUAN TRỌNG:
${context.hocTapNote}

Tiêu chí "Học tập tốt" gồm 2 phần:
A. Tiêu chuẩn bắt buộc: GPA, không nợ môn/học phần/tín chỉ, không gian lận trong thi cử, thái độ học tập đúng đắn.
B. Tiêu chuẩn khác: sinh viên phải đạt ít nhất 01 minh chứng học thuật khác.

Tài liệu này chỉ dùng để AI hỗ trợ phân tích phần B - Tiêu chuẩn khác.

Các loại minh chứng hợp lệ cho cấp Trường:
[1] Tham gia và vượt qua vòng đầu tiên hoặc là thành viên Ban Tổ chức của cuộc thi học thuật cấp Khoa trở lên.
[2] Có đề tài nghiên cứu khoa học sinh viên hoặc khóa luận tốt nghiệp trong năm học được nghiệm thu từ 7.0 điểm hoặc loại Khá trở lên, hoặc đạt giải cấp Trường/Khoa theo quy chế.
[3] Tham gia cuộc thi ý tưởng sáng tạo, nghiên cứu khoa học từ cấp Khoa/Bộ môn trở lên.
[4] Tham gia ít nhất 03 hoạt động học thuật và có giấy xác nhận. Hoạt động cổ vũ cuộc thi học thuật chỉ tính chung là 01 hoạt động.
[5] Là trợ giảng ít nhất 01 học kỳ và có giấy xác nhận phù hợp.
[6] Có bài viết đăng trên báo/tạp chí chuyên ngành hoặc bài tham luận hội thảo khoa học/sinh hoạt chuyên đề cấp Khoa trở lên.
[7] Có sản phẩm sáng tạo, giải pháp hữu ích, bằng sáng chế, đơn đăng ký chứng nhận quyền sở hữu trí tuệ hoặc giấy phép xuất bản.
[8] Là thành viên chính thức đội tuyển tham gia cuộc thi học thuật cấp quốc gia hoặc quốc tế.

Quy tắc riêng cho AI:
- Nếu tài liệu thuộc nhóm [4] "Tham gia ít nhất 03 hoạt động học thuật", trả academicEvidenceType = "hocThuat_3_activities".
- Nếu tài liệu chỉ xác nhận 01 hoạt động học thuật thông thường, trả academicActivityCount = 1 và isValid = null để cộng dồn.
- Nếu tài liệu ghi rõ sinh viên đã tham gia đủ 03 hoạt động học thuật, trả academicActivityCount = 3 và có thể trả isValid = true nếu thông tin rõ.
- Không kết luận đạt tiêu chuẩn khác nếu mới chỉ có 1 hoặc 2 hoạt động học thuật thông thường, nhưng vẫn xem là minh chứng hợp lệ một phần để cộng dồn.
- Nếu tài liệu thuộc nhóm NCKH, sáng tạo, trợ giảng, bài báo, đội tuyển học thuật hoặc minh chứng trực tiếp khác thì trả academicEvidenceType tương ứng và academicActivityCount = 0.
- Không tự suy đoán cấp tổ chức hoặc thành tích nếu file không thể hiện rõ.

${contentDescription}

Trả lời đúng JSON, không thêm markdown:
{
  "isValid": true hoặc false hoặc null,
  "confidence": số nguyên từ 0 đến 100,
  "matchedType": "loại minh chứng học tập khớp",
  "academicEvidenceType": "hocThuat_3_activities hoặc nghienCuu hoặc sangTao hoặc troGiang hoặc baiBao hoặc doiTuyen hoặc khac_direct hoặc chuỗi rỗng",
  "academicActivityCount": số hoạt động học thuật xác định được, nếu không thuộc nhóm hoạt động học thuật thì để 0,
  "extractedText": "tóm tắt nội dung tài liệu",
  "matchedEvidence": ["điều kiện đã đáp ứng"],
  "missingInfo": ["thông tin còn thiếu nếu có"],
  "reason": "lý do cụ thể bằng tiếng Việt"
}`;
}

module.exports = { buildHocTapPrompt };