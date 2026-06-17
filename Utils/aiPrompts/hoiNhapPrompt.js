const { getAiAwardLevelContext } = require("./context");

function buildHoiNhapPrompt(contentDescription, awardLevel = "truong") {
  const context = getAiAwardLevelContext(awardLevel);
  const isDhqgLevel = awardLevel === "dhqg";
  const isThanhLevel = awardLevel === "thanh";

  return `Đây là minh chứng cho tiêu chí "Hội nhập tốt" trong chương trình Sinh viên 5 tốt ${context.label}.

Nhiệm vụ:
- Đọc nội dung OCR hoặc mô tả file minh chứng.
- Xác định tài liệu thuộc nhóm nào trong Hội nhập tốt và có hợp lệ không.
- Chỉ đưa ra đề xuất AI. Quyết định cuối cùng thuộc về admin.

LƯU Ý THEO CẤP XÉT:
${context.hoiNhapNote}

Tiêu chí "Hội nhập tốt" gồm 3 nhóm. Sinh viên cần đạt đủ cả 3 nhóm:
5.1. Ngoại ngữ
5.2. Kỹ năng
5.3. Hoạt động hội nhập

NHÓM 1 - NGOẠI NGỮ, subCriteria = "ngoaiNgu":
- Dùng cho minh chứng ngoại ngữ cơ bản.
- Chấp nhận chứng chỉ ngoại ngữ tương đương B1 trở lên hoặc mức cao hơn theo quy chế cấp xét hiện tại.
- Chấp nhận điểm học phần ngoại ngữ đạt ngưỡng theo quy chế cấp xét hiện tại.
- Chấp nhận cuộc thi kiến thức ngoại ngữ từ cấp Khoa/cấp Trường trở lên tùy cấp xét.
- Chứng chỉ phải còn hiệu lực nếu tài liệu có ghi thời hạn.

${isDhqgLevel ? `- QUY TẮC RIÊNG CẤP ĐHQG-HCM: Không chấp nhận chứng nhận trong các đợt thi thử. Nếu tài liệu có dấu hiệu là thi thử, mock test, practice test, placement test thử, kiểm tra thử, chứng nhận thử, kết quả thi thử hoặc giấy chứng nhận từ một đợt thi thử thì phải đánh giá là không hợp lệ cho nhóm Ngoại ngữ cấp ĐHQG-HCM.` : ""}

${isThanhLevel ? `- QUY TẮC RIÊNG CẤP THÀNH PHỐ:
  Đối với cấp Thành phố, phần Ngoại ngữ gồm 02 chi Hội điều kiện:
  (A) Điều kiện ngoại ngữ cơ bản: chứng chỉ ngoại ngữ B1 trở lên hoặc điểm học phần ngoại ngữ đạt ngưỡng theo quy chế.
  (B) Điều kiện bổ sung ngoại ngữ: sinh viên phải đạt thêm 01 trong 02 tiêu chí sau:
      (1) Có giấy chứng nhận tham gia ít nhất 01 hoạt động giao lưu quốc tế, hội nghị/hội thảo quốc tế, chương trình gặp gỡ/giao lưu/hợp tác với thanh niên, sinh viên quốc tế trong và ngoài nước.
      (2) Đạt giải Ba trở lên tại cuộc thi về kiến thức hội nhập hoặc cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên.

  LƯU Ý QUAN TRỌNG:
  - Nếu minh chứng là chứng chỉ ngoại ngữ hoặc điểm học phần ngoại ngữ, hãy phân loại là subCriteria = "ngoaiNgu".
  - Nếu minh chứng là hoạt động giao lưu quốc tế, hội nghị quốc tế, hội thảo quốc tế, chương trình hợp tác/giao lưu với sinh viên quốc tế, hãy phân loại là subCriteria = "hoiNhap" và hoiNhapEvidenceType = "international_exchange".
  - Nếu minh chứng là giải Ba trở lên tại cuộc thi kiến thức hội nhập hoặc cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên, hãy phân loại là subCriteria = "hoiNhap" và hoiNhapEvidenceType = "foreign_language_academic_competition_award_truong_or_above".
  - Tuy các minh chứng này được dùng để hoàn thành điều kiện bổ sung của phần Ngoại ngữ cấp Thành phố, nhưng không được ép chúng thành subCriteria = "ngoaiNgu" nếu bản chất là hoạt động hội nhập hoặc cuộc thi hội nhập.` : ""}

NHÓM 2 - KỸ NĂNG, subCriteria = "kyNang":

Cấp Trường:
- Hoàn thành ít nhất 01 khóa trang bị kỹ năng thực hành xã hội.
- Đạt giải trong cuộc thi kỹ năng từ cấp Khoa trở lên.
- Là báo cáo viên chi Hội kỹ năng từ cấp Khoa hoặc tương đương trở lên.
- Được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về thành tích xuất sắc trong công tác Đoàn/Hội hoặc phong trào sinh viên.
- Tham gia và vào vòng Chung kết cuộc thi thủ lĩnh sinh viên cấp Trường trở lên.

Cấp ĐHQG-HCM:
- Hoàn thành ít nhất 01 khóa trang bị kỹ năng thực hành xã hội.
- Đạt giải trong cuộc thi kỹ năng từ cấp Trường trở lên.
- Là báo cáo viên chi Hội kỹ năng từ cấp Trường trở lên.
- Được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về thành tích xuất sắc trong công tác Đoàn/Hội hoặc phong trào sinh viên.

Cấp Thành phố:
- Hoàn thành ít nhất 01 khóa trang bị kỹ năng thực hành xã hội.
- Được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về thành tích xuất sắc trong công tác Đoàn/Hội hoặc phong trào sinh viên.

Nếu tài liệu là minh chứng kỹ năng, trả thêm kyNangEvidenceType:
- "skill_course" nếu là giấy chứng nhận hoàn thành khóa kỹ năng.
- "skill_competition_award_khoa_or_above" nếu là giải cuộc thi kỹ năng từ cấp Khoa trở lên.
- "skill_competition_award_truong_or_above" nếu là giải cuộc thi kỹ năng từ cấp Trường trở lên.
- "skill_reporter_khoa_or_above" nếu là báo cáo viên chi Hội kỹ năng từ cấp Khoa/tương đương trở lên.
- "skill_reporter_truong_or_above" nếu là báo cáo viên chi Hội kỹ năng từ cấp Trường trở lên.
- "union_association_award_truong_or_above" nếu là khen thưởng Đoàn/Hội từ cấp Trường trở lên.
- "student_leader_competition_finalist_truong_or_above" nếu là vào chung kết cuộc thi thủ lĩnh sinh viên cấp Trường trở lên.
- "unknown" nếu không xác định được.

NHÓM 3 - HOẠT ĐỘNG HỘI NHẬP, subCriteria = "hoiNhap":

Cấp Trường:
- Tham gia hoạt động giao lưu quốc tế.
- Tham gia/vượt qua vòng đầu hoặc là Ban Tổ chức cuộc thi tìm hiểu văn hóa/hội nhập từ cấp Khoa trở lên.
- Là thành viên chính thức chương trình giao lưu/hợp tác quốc tế.
- Là tình nguyện viên theo đoàn/chương trình giao lưu quốc tế.

Cấp ĐHQG-HCM:
- Tham gia hoạt động giao lưu quốc tế.
- Đạt giải Ba trở lên cuộc thi kiến thức hội nhập hoặc cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên.
- Là thành viên chính thức hoặc tình nguyện viên chương trình giao lưu quốc tế.

Cấp Thành phố:
- Tham gia tích cực ít nhất 01 hoạt động về hội nhập do cấp Trường tổ chức trở lên.

Nếu tài liệu là minh chứng hoạt động hội nhập, trả thêm hoiNhapEvidenceType:
- "international_exchange" nếu là hoạt động giao lưu quốc tế/hội nghị/hội thảo quốc tế.
- "integration_competition_khoa_or_above" nếu là cuộc thi tìm hiểu văn hóa/hội nhập từ cấp Khoa trở lên.
- "integration_competition_award_truong_or_above" nếu là giải Ba trở lên cuộc thi kiến thức hội nhập từ cấp Trường trở lên.
- "foreign_language_academic_competition_award_truong_or_above" nếu là giải Ba trở lên cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên.
- "official_international_program_member" nếu là thành viên chính thức chương trình giao lưu/hợp tác quốc tế.
- "international_program_volunteer" nếu là tình nguyện viên chương trình giao lưu/hợp tác quốc tế.
- "integration_activity_truong_or_above" nếu là hoạt động hội nhập do cấp Trường tổ chức trở lên.
- "unknown" nếu không xác định được.

Quy tắc riêng cho AI:
- Chọn đúng 01 subCriteria phù hợp nhất: "ngoaiNgu", "kyNang", "hoiNhap".
- Nếu tài liệu có thể thuộc nhiều nhóm, chọn nhóm rõ nhất và ghi nhóm còn lại trong matchedEvidence.
- Nếu thiếu cấp tổ chức, thiếu thời hạn chứng chỉ, thiếu điểm/số hiệu chứng chỉ, thiếu xác nhận hoặc thiếu tên sinh viên, đưa vào missingInfo.
- Không tự suy đoán cấp tổ chức hoặc giá trị chứng chỉ nếu file không thể hiện rõ.

Quy tắc phân loại riêng cho nhóm Ngoại ngữ:
- Nếu là chứng chỉ ngoại ngữ, foreignLanguageEvidenceType = "language_certificate".
- Nếu là điểm học phần ngoại ngữ, foreignLanguageEvidenceType = "course_score".
- Nếu là giấy chứng nhận tham gia hoạt động giao lưu quốc tế, foreignLanguageEvidenceType = "international_exchange".
- Nếu là giải Ba trở lên cuộc thi kiến thức hội nhập, foreignLanguageEvidenceType = "integration_competition_award".
- Nếu là giải Ba trở lên cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên, foreignLanguageEvidenceType = "foreign_language_academic_competition_award".
- Nếu không xác định được loại minh chứng ngoại ngữ, foreignLanguageEvidenceType = "unknown".
- Nếu tài liệu là giải thưởng, phải cố gắng xác định awardRank và organizerLevel.
- Nếu tài liệu là giải thưởng nhưng thiếu hạng giải hoặc cấp tổ chức, thêm thông tin còn thiếu vào missingInfo.
${isDhqgLevel ? `- Riêng cấp ĐHQG-HCM: Nếu tài liệu thuộc nhóm Ngoại ngữ nhưng có các cụm như "thi thử", "kỳ thi thử", "mock test", "practice test", "trial test", "placement test thử", "kiểm tra thử", "chứng nhận thử", "kết quả thi thử", thì trả isValid = false, subCriteria = "ngoaiNgu", confidence tối thiểu 80 nếu thông tin rõ, và giải thích rằng cấp ĐHQG-HCM không chấp nhận chứng nhận trong các đợt thi thử.` : ""}

${contentDescription}

Trả lời đúng JSON, không thêm markdown:
{
  "isValid": true hoặc false hoặc null,
  "confidence": số nguyên từ 0 đến 100,
  "subCriteria": "ngoaiNgu hoặc kyNang hoặc hoiNhap hoặc chuỗi rỗng",
  "matchedType": "loại minh chứng hội nhập khớp",
  "foreignLanguageEvidenceType": "language_certificate hoặc course_score hoặc international_exchange hoặc integration_competition_award hoặc foreign_language_academic_competition_award hoặc unknown hoặc chuỗi rỗng",
  "awardRank": "nhat hoặc nhi hoặc ba hoặc khuyen_khich hoặc chuỗi rỗng",
  "organizerLevel": "khoa hoặc truong hoặc dhqg hoặc thanh hoặc quoc_gia hoặc quoc_te hoặc chuỗi rỗng",
  "kyNangEvidenceType": "skill_course hoặc skill_competition_award_khoa_or_above hoặc skill_competition_award_truong_or_above hoặc skill_reporter_khoa_or_above hoặc skill_reporter_truong_or_above hoặc union_association_award_truong_or_above hoặc student_leader_competition_finalist_truong_or_above hoặc unknown hoặc chuỗi rỗng",
  "hoiNhapEvidenceType": "international_exchange hoặc integration_competition_khoa_or_above hoặc integration_competition_award_truong_or_above hoặc foreign_language_academic_competition_award_truong_or_above hoặc official_international_program_member hoặc international_program_volunteer hoặc integration_activity_truong_or_above hoặc unknown hoặc chuỗi rỗng",
  "extractedText": "tóm tắt nội dung tài liệu",
  "matchedEvidence": ["điều kiện đã đáp ứng"],
  "missingInfo": ["thông tin còn thiếu nếu có"],
  "reason": "lý do cụ thể bằng tiếng Việt"
}`;
}

module.exports = { buildHoiNhapPrompt };