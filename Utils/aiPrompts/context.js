const { normalizeAwardLevel } = require("../sv5tLevels");

/**
 * Trả về ghi chú theo cấp xét để nhúng vào prompt AI.
 * Dùng chung cho tất cả các file prompt.
 */
function getAiAwardLevelContext(awardLevel) {
  const normalizedLevel = normalizeAwardLevel(awardLevel || "truong");

  const contexts = {
    truong: {
      label: "Cấp Trường",
      hocTapNote:
        "Áp dụng quy chế cấp Trường. Riêng nhóm giấy xác nhận hoạt động học thuật thông thường có thể cần cộng dồn đủ 03 hoạt động.",
      volunteerNote:
        "Cấp Trường chấp nhận đủ ít nhất 05 ngày tình nguyện trong năm học hoặc giấy khen/khen thưởng tình nguyện phù hợp từ cấp Trường trở lên.",
      theLucNote:
        "Cấp Trường chấp nhận Thanh niên khỏe từ cấp Trường trở lên, hoạt động thể thao phù hợp từ cấp Khoa trở lên hoặc minh chứng rèn luyện thể thao đủ thời lượng theo quy chế.",
      hoiNhapNote:
        "Cấp Trường yêu cầu đạt đủ 03 nhóm Hội nhập tốt: Ngoại ngữ, Kỹ năng, Hoạt động hội nhập."
    },

    dhqg: {
      label: "Cấp ĐHQG-HCM",
      hocTapNote:
        "Áp dụng quy chế cấp ĐHQG-HCM. Tiêu chuẩn khác yêu cầu đạt ít nhất 01 nhóm minh chứng học thuật hợp lệ. Không áp dụng yêu cầu đủ 03 hoạt động học thuật nếu minh chứng chỉ dùng để xét cấp ĐHQG-HCM.",
      volunteerNote:
        "Cấp ĐHQG-HCM chấp nhận khen thưởng tình nguyện từ cấp Trường trở lên hoặc tham gia ít nhất 05 ngày tình nguyện trong năm học.",
      theLucNote:
        "Cấp ĐHQG-HCM chấp nhận Thanh niên khỏe từ cấp Trường trở lên, hoạt động thể thao cấp ĐHQG-HCM/Thành phố/Trung ương, hoặc là thành viên chính thức đội tuyển cấp Trường trở lên.",
      hoiNhapNote:
        "Cấp ĐHQG-HCM yêu cầu đạt đủ 03 nhóm Hội nhập tốt: Ngoại ngữ, Kỹ năng, Hoạt động hội nhập."
    },

    thanh: {
      label: "Cấp Thành phố Hồ Chí Minh",
      hocTapNote:
        "Áp dụng quy chế cấp Thành phố Hồ Chí Minh. Tiêu chuẩn khác yêu cầu đạt ít nhất 01 nhóm minh chứng học thuật hợp lệ. Không áp dụng yêu cầu đủ 03 hoạt động học thuật nếu minh chứng chỉ dùng để xét cấp Thành phố.",
      volunteerNote:
        "Cấp Thành phố yêu cầu sinh viên có ít nhất 05 ngày tình nguyện trong năm học và có khen thưởng tình nguyện từ cấp Trường trở lên.",
      theLucNote:
        "Cấp Thành phố chấp nhận Thanh niên khỏe từ cấp Trường trở lên, hoạt động thể thao cấp Thành phố/cấp Trung ương, hoặc là thành viên chính thức đội tuyển cấp Thành phố/cấp Quốc gia.",
      hoiNhapNote:
        "Cấp Thành phố yêu cầu đạt đủ 03 nhóm Hội nhập tốt: Ngoại ngữ, Kỹ năng, Hoạt động hội nhập."
    }
  };

  return contexts[normalizedLevel] || contexts.truong;
}

module.exports = { getAiAwardLevelContext };