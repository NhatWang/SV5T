const CENTRAL_CATEGORIES = [
  "daoDucTot",
  "hocTapTot",
  "theLucTot",
  "tinhNguyenTot",
  "hoiNhapTot"
];

const CENTRAL_CATEGORY_LABELS = {
  daoDucTot: "Đạo đức tốt",
  hocTapTot: "Học tập tốt",
  theLucTot: "Thể lực tốt",
  tinhNguyenTot: "Tình nguyện tốt",
  hoiNhapTot: "Hội nhập tốt"
};

const CENTRAL_MANDATORY_CRITERIA = {
  daoDucTot: {
    label: "Đạo đức tốt",
    requiredAll: true,
    conditions: [
      {
        key: "training_score_95",
        text: "Điểm rèn luyện đạt từ 95/100 trở lên."
      },
      {
        key: "no_violation_confirmed",
        text:
          "Được xác nhận tại thời điểm xét trao danh hiệu không vi phạm pháp luật và các quy chế, nội quy của nhà trường, quy định của địa phương và cộng đồng."
      }
    ]
  },

  hocTapTot: {
    label: "Học tập tốt",
    requiredAll: true,
    conditions: [
      {
        key: "gpa_34_or_85",
        text:
          "Điểm trung bình chung học tập cả năm học đạt từ 3.4/4 trở lên hoặc đạt từ 8.5/10 trở lên."
      }
    ]
  },

  theLucTot: {
    label: "Thể lực tốt",
    requiredAll: true,
    conditions: [
      {
        key: "sport_award_school_or_central_activity",
        text:
          "Tham gia và đạt giải các hoạt động thể thao cấp Trường trở lên hoặc tham gia các hoạt động thể thao cấp Trung ương."
      }
    ]
  },

  tinhNguyenTot: {
    label: "Tình nguyện tốt",
    requiredAll: true,
    conditions: [
      {
        key: "volunteer_5_days",
        text:
          "Tham gia ít nhất 05 ngày tình nguyện trong năm, được tính theo số ngày thực tế tham gia các hoạt động tình nguyện cộng dồn."
      }
    ]
  },

  hoiNhapTot: {
    label: "Hội nhập tốt",
    requiredAll: true,
    conditions: [
      {
        key: "foreign_language_b2_or_score",
        text:
          "Đạt chứng chỉ tiếng Anh trình độ B2 hoặc tương đương B2, hoặc chứng chỉ ngoại ngữ khác ở trình độ tương đương trở lên, hoặc tổng điểm các học phần ngoại ngữ tích lũy từ 3.4/4 trở lên hoặc từ 8.5/10 trở lên."
      },
      {
        key: "international_exchange_activity",
        text:
          "Tham gia ít nhất 01 hoạt động giao lưu quốc tế như hội nghị, hội thảo quốc tế, chương trình gặp gỡ, giao lưu, hợp tác với thanh niên, sinh viên quốc tế trong và ngoài nước."
      }
    ]
  }
};

const CENTRAL_ADDITIONAL_CRITERIA = [
  {
    key: "daoDuc_1",
    category: "daoDucTot",
    label: "Đạo đức tốt - Gương tiêu biểu",
    text:
      "Là thanh niên tiêu biểu, thanh niên tiên tiến làm theo lời Bác, gương người tốt, việc tốt, gương thanh niên, sinh viên sống đẹp hoặc gương có hành động dũng cảm cứu người được cấp tỉnh, thành phố trở lên biểu dương, ghi nhận."
  },
  {
    key: "daoDuc_2",
    category: "daoDucTot",
    label: "Đạo đức tốt - Đảng viên xuất sắc",
    text:
      "Đạt xếp loại Đảng viên hoàn thành xuất sắc nhiệm vụ trong năm gần nhất."
  },

  {
    key: "hocTap_1",
    category: "hocTapTot",
    label: "Học tập tốt - Nghiên cứu khoa học",
    text:
      "Có đề tài nghiên cứu khoa học, không áp dụng đối với luận văn tốt nghiệp, đạt giải từ cấp tỉnh, thành phố trở lên."
  },
  {
    key: "hocTap_2",
    category: "hocTapTot",
    label: "Học tập tốt - Bài báo WoS/Scopus Q1, Q2",
    text:
      "Là tác giả bài viết đăng trên tạp chí khoa học quốc tế uy tín, có mã số chuẩn quốc tế ISSN, thuộc danh mục WoS/Scopus Q1 hoặc Q2."
  },
  {
    key: "hocTap_3",
    category: "hocTapTot",
    label: "Học tập tốt - Tác giả chính bài báo WoS/Scopus Q3, Q4",
    text:
      "Là tác giả chính bài viết đăng trên tạp chí khoa học quốc tế uy tín, có mã số chuẩn quốc tế ISSN, thuộc danh mục WoS/Scopus Q3 hoặc Q4."
  },
  {
    key: "hocTap_4",
    category: "hocTapTot",
    label: "Học tập tốt - Sản phẩm sáng tạo",
    text:
      "Có sản phẩm sáng tạo được cấp bằng sáng chế, cấp giấy phép xuất bản hoặc được các giải thưởng từ cấp tỉnh trở lên."
  },
  {
    key: "hocTap_5",
    category: "hocTapTot",
    label: "Học tập tốt - Giải học thuật cấp quốc gia/quốc tế",
    text:
      "Đạt giải Ba trở lên trong các cuộc thi về học thuật, khoa học kỹ thuật hoặc ý tưởng sáng tạo khởi nghiệp cấp quốc gia hoặc quốc tế."
  },

  {
    key: "theLuc_1",
    category: "theLucTot",
    label: "Thể lực tốt - Giải thể thao từ cấp tỉnh",
    text:
      "Tham gia và đạt giải Ba trở lên trong các hoạt động thể thao từ cấp tỉnh trở lên."
  },

  {
    key: "tinhNguyen_1",
    category: "tinhNguyenTot",
    label: "Tình nguyện tốt - Dự án tình nguyện",
    text:
      "Là người sáng lập hoặc đồng sáng lập các dự án tình nguyện đem lại kết quả thiết thực đối với tổ chức, đơn vị được thụ hưởng và được nhận xét, đánh giá, giới thiệu từ tổ chức, đơn vị thụ hưởng."
  },
  {
    key: "tinhNguyen_2",
    category: "tinhNguyenTot",
    label: "Tình nguyện tốt - Khen thưởng tình nguyện",
    text:
      "Được khen thưởng từ cấp tỉnh trở lên về hoạt động tình nguyện."
  },

  {
    key: "hoiNhap_1",
    category: "hoiNhapTot",
    label: "Hội nhập tốt - Ban chủ nhiệm CLB ngoại ngữ",
    text:
      "Là thành viên ban chủ nhiệm các câu lạc bộ, đội, nhóm ngoại ngữ tại các cơ sở giáo dục hoặc địa bàn dân cư, thường xuyên tổ chức các hoạt động giao lưu, trao đổi nâng cao năng lực ngoại ngữ và hội nhập quốc tế."
  },
  {
    key: "hoiNhap_2",
    category: "hoiNhapTot",
    label: "Hội nhập tốt - Giải hội nhập hoặc học thuật bằng ngoại ngữ",
    text:
      "Đạt giải Ba trở lên tại các cuộc thi về kiến thức hội nhập hoặc các cuộc thi học thuật bằng ngoại ngữ từ cấp tỉnh trở lên."
  },
  {
    key: "hoiNhap_3",
    category: "hoiNhapTot",
    label: "Hội nhập tốt - Hai ngoại ngữ",
    text:
      "Đạt chứng chỉ tương đương trình độ B1 trở lên đối với ít nhất 02 ngoại ngữ khác nhau. Riêng chứng chỉ tiếng Anh cần đạt trình độ B2 hoặc tương đương B2 trở lên."
  }
];

function getCentralMandatoryCriteria(category) {
  return CENTRAL_MANDATORY_CRITERIA[category] || null;
}

function getCentralAdditionalCriteriaByCategory(category) {
  return CENTRAL_ADDITIONAL_CRITERIA.filter((item) => {
    return item.category === category;
  });
}

function getAllCentralAdditionalCriteria() {
  return CENTRAL_ADDITIONAL_CRITERIA;
}

function getCentralCriteriaForCategory(category) {
  return {
    mandatory: getCentralMandatoryCriteria(category),
    additional: getCentralAdditionalCriteriaByCategory(category)
  };
}

module.exports = {
  CENTRAL_CATEGORIES,
  CENTRAL_CATEGORY_LABELS,
  CENTRAL_MANDATORY_CRITERIA,
  CENTRAL_ADDITIONAL_CRITERIA,
  getCentralMandatoryCriteria,
  getCentralAdditionalCriteriaByCategory,
  getAllCentralAdditionalCriteria,
  getCentralCriteriaForCategory
};