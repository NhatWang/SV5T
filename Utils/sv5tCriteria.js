const { AWARD_LEVELS } = require("./sv5tLevels");

const categoryLabels = {
  daoDucTot: "Đạo đức tốt",
  hocTapTot: "Học tập tốt",
  theLucTot: "Thể lực tốt",
  tinhNguyenTot: "Tình nguyện tốt",
  hoiNhapTot: "Hội nhập tốt"
};

const B1_EQUIVALENTS = {
  IELTS: {
    minScore: 4.5,
    note: "IELTS 4.5 trở lên tương đương B1"
  },
  TOEFL_IBT: {
    minScore: 35,
    note: "TOEFL iBT 35 trở lên tương đương B1"
  },
  TOEIC: {
    minScore: 401,
    note: "TOEIC Nghe + Đọc 401 trở lên tương đương B1"
  },
  VNU_EPT: {
    minScore: 201,
    note: "VNU-EPT 201 trở lên tương đương B1"
  },
  DELF: {
    level: "B1",
    note: "DELF B1 trở lên"
  },
  TCF: {
    level: "niveau 3",
    note: "TCF niveau 3 trở lên"
  },
  GOETHE: {
    level: "B1",
    note: "Goethe B1 trở lên"
  },
  HSK: {
    level: "3",
    note: "HSK cấp độ 3 trở lên"
  },
  JLPT: {
    level: "N4",
    note: "JLPT N4 trở lên"
  },
  TOPIK: {
    level: "II level 3",
    note: "TOPIK II level 3 trở lên"
  },
  TRKI: {
    level: "1",
    note: "TRKI 1 trở lên"
  }
};

const DIRECT_HOC_TAP_TYPES = [
  "nghienCuu",
  "sangTao",
  "troGiang",
  "baiBao",
  "doiTuyen",
  "khac_direct"
];

const officialCriteriaByLevel = {
  // =====================================================
  // CẤP TRƯỜNG
  // Theo Quyết định 49/QĐ-HSV ngày 25/12/2023
  // =====================================================
  [AWARD_LEVELS.TRUONG]: {
    common: {
      title: "Sinh viên 5 tốt cấp Trường",
      required: []
    },

    daoDucTot: {
      title: "Đạo đức tốt - Cấp Trường",
      label: "Đạo đức tốt",

      mandatory: [
        "Điểm rèn luyện đạt từ 70 điểm trở lên trên thang điểm 100.",
        "Không vi phạm pháp luật.",
        "Không vi phạm quy chế, nội quy của trường, lớp, quy định của địa phương cư trú và nơi công cộng.",
        "Đánh giá chất lượng Đoàn viên/Hội viên cuối năm đạt Hoàn thành xuất sắc nhiệm vụ."
      ],

      batBuoc: [
        "Điểm rèn luyện năm học đạt từ 70/100 trở lên.",
        "Không vi phạm pháp luật.",
        "Không vi phạm quy chế, nội quy của trường, lớp, địa phương cư trú và nơi công cộng.",
        "Đánh giá chất lượng Đoàn viên/Hội viên cuối năm đạt Hoàn thành xuất sắc nhiệm vụ."
        ],
      otherRequiredRule: "Khuyến khích có thêm minh chứng đạo đức, khen thưởng hoặc hoạt động rèn luyện phù hợp.",

      evidenceTypes: [
        "Điểm rèn luyện có xác nhận của đơn vị phụ trách.",
        "Kết quả đánh giá Đoàn viên/Hội viên cuối năm.",
        "Cam kết hoặc xác nhận không vi phạm pháp luật, quy chế, nội quy.",
        "Giấy khen của Hiệu trưởng, Ban Chủ nhiệm Khoa hoặc tổ chức Đoàn - Hội.",
        "Minh chứng tham gia hoạt động học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh.",
        "Minh chứng tham gia đội thi tìm hiểu về chủ nghĩa Mác - Lênin, tư tưởng Hồ Chí Minh từ cấp Trường trở lên."
      ],

      minhChung: [
        "Bảng điểm rèn luyện hoặc xác nhận điểm rèn luyện năm học.",
        "Kết quả đánh giá Đoàn viên/Hội viên cuối năm.",
        "Cam kết hoặc xác nhận không vi phạm pháp luật, quy chế, nội quy.",
        "Giấy khen, giấy xác nhận hoặc minh chứng tham gia hoạt động rèn luyện đạo đức nếu có."
        ],

      aiRules: {
        selfDeclare: true,
        skipAI: true,
        trainingScoreRequired: 70,
        requireNoViolation: true,
        requireExcellentUnionMember: true
      }
    },

    hocTapTot: {
      title: "Học tập tốt - Cấp Trường",
      label: "Học tập tốt",

      mandatory: [
        "Có động cơ, thái độ học tập đúng đắn.",
        "Không gian lận trong thi cử.",
        "Không nợ môn, học phần hoặc tín chỉ trong năm học.",
        "Điểm trung bình chung học tập cả năm đạt từ 7.0/10 trở lên hoặc từ 2.8/4.0 trở lên."
      ],

      batBuoc: [
        "GPA cả năm đạt từ 7.0/10 trở lên hoặc từ 2.8/4.0 trở lên.",
        "Không nợ môn, học phần hoặc tín chỉ trong năm học.",
        "Không gian lận trong học tập, thi cử.",
        "Có động cơ, thái độ học tập đúng đắn.",
        "Đạt thêm ít nhất 01 tiêu chuẩn học thuật khác theo quy chế cấp Trường."
        ],

      otherRequiredRule: "Đạt ít nhất 01 tiêu chuẩn học thuật khác.",

      evidenceTypes: [
        "Tham gia và vượt qua vòng đầu tiên hoặc là thành viên Ban Tổ chức của các cuộc thi học thuật cấp Khoa trở lên.",
        "Có đề tài nghiên cứu khoa học sinh viên hoặc khóa luận tốt nghiệp trong năm học được hội đồng khoa học cấp Trường nghiệm thu đánh giá từ 7.0 điểm hoặc loại Khá trở lên, hoặc đạt giải cấp Trường trở lên.",
        "Có đề tài nghiên cứu khoa học sinh viên hoặc khóa luận tốt nghiệp trong năm học được hội đồng khoa học cấp Khoa/Bộ môn nghiệm thu đánh giá từ 7.0 điểm hoặc loại Khá trở lên.",
        "Tham gia các cuộc thi ý tưởng sáng tạo, nghiên cứu khoa học từ cấp Khoa/Bộ môn trở lên.",
        "Tham gia ít nhất 03 hoạt động học thuật và có giấy xác nhận. Các hoạt động cổ vũ cuộc thi học thuật chỉ được tính chung là 01 hoạt động.",
        "Là trợ giảng ít nhất 01 học kỳ các lớp học tập, có giấy xác nhận của Chi ủy - Ban Chủ nhiệm Khoa.",
        "Có bài viết đăng trên báo, tạp chí chuyên ngành của trường hoặc có bài tham luận tham gia hội thảo khoa học, sinh hoạt chuyên đề cấp Khoa trở lên.",
        "Có sản phẩm sáng tạo, giải pháp hữu ích được cấp bằng sáng chế hoặc được chấp nhận đơn đăng ký chứng nhận quyền sở hữu trí tuệ, cấp giấy phép xuất bản.",
        "Là thành viên chính thức đội tuyển tham gia các cuộc thi học thuật cấp quốc gia hoặc quốc tế."
      ],

      minhChung: [
        "Dữ liệu GPA, tình trạng nợ môn, vi phạm học tập và thái độ học tập đã khai.",
        "Giấy chứng nhận tham gia và vượt qua vòng đầu tiên hoặc là thành viên Ban Tổ chức cuộc thi học thuật cấp Khoa trở lên.",
        "Minh chứng đề tài nghiên cứu khoa học sinh viên hoặc khóa luận tốt nghiệp được nghiệm thu từ 7.0 điểm hoặc loại Khá trở lên.",
        "Minh chứng đạt giải hoặc tham gia cuộc thi ý tưởng sáng tạo, nghiên cứu khoa học từ cấp Khoa/Bộ môn trở lên.",
        "Giấy xác nhận tham gia ít nhất 03 hoạt động học thuật.",
        "Giấy xác nhận trợ giảng ít nhất 01 học kỳ.",
        "Bài báo, bài tham luận hội thảo khoa học hoặc sinh hoạt chuyên đề cấp Khoa trở lên.",
        "Minh chứng sản phẩm sáng tạo, giải pháp hữu ích, bằng sáng chế hoặc đơn đăng ký sở hữu trí tuệ.",
        "Minh chứng là thành viên chính thức đội tuyển tham gia cuộc thi học thuật cấp quốc gia hoặc quốc tế."
        ],

      aiRules: {
        mandatorySelfDeclare: true,
        evidenceOnlyForExtraCriteria: true,
        gpa10Required: 7.0,
        gpa4Required: 2.8,
        academicActivityCountRequired: 3,
        allowAcademicActivityAccumulation: true,
        directTypes: DIRECT_HOC_TAP_TYPES,
        researchScoreRequired: 7.0,
        researchGradeRequired: "Khá"
      }
    },

    theLucTot: {
      title: "Thể lực tốt - Cấp Trường",
      label: "Thể lực tốt",

      rule: "Đạt ít nhất 01 tiêu chuẩn về rèn luyện thể lực hoặc hoạt động thể thao.",

      mandatory: [
        "Đạt ít nhất 01 tiêu chuẩn về rèn luyện thể lực hoặc hoạt động thể thao."
      ],

      batBuoc: [
        "Đạt ít nhất 01 tiêu chuẩn về rèn luyện thể lực hoặc hoạt động thể thao theo quy chế cấp Trường."
        ],

      evidenceTypes: [
        "Giấy chứng nhận Thanh niên khỏe từ cấp Trường.",
        "Giấy chứng nhận hoặc huy chương/giải thưởng thể thao từ cấp Khoa trở lên, không tính thể thao điện tử.",
        "Xác nhận tham gia ít nhất 03 hoạt động của Câu lạc bộ Thể dục - Thể thao cấp Khoa trở lên, có xác nhận của Ban Chủ nhiệm Câu lạc bộ và BCH Liên chi Hội.",
        "Là thành viên chính thức đội tuyển cấp Trường trở lên ở các môn thể dục thể thao.",
        "Giấy chứng nhận luyện tập thể dục thể thao tại trung tâm tối thiểu 03 tháng.",
        "Hóa đơn tham gia và minh chứng hình ảnh tập Gym/Yoga tối thiểu 03 tháng, thể hiện rõ thời gian luyện tập."
      ],

      minhChung: [
        "Giấy chứng nhận Thanh niên khỏe từ cấp Trường.",
        "Giấy chứng nhận, huy chương hoặc giải thưởng thể thao từ cấp Khoa trở lên, không tính thể thao điện tử.",
        "Xác nhận tham gia ít nhất 03 hoạt động của Câu lạc bộ Thể dục - Thể thao cấp Khoa trở lên.",
        "Xác nhận là thành viên chính thức đội tuyển thể thao cấp Trường trở lên.",
        "Giấy chứng nhận luyện tập thể dục thể thao tại trung tâm tối thiểu 03 tháng.",
        "Hóa đơn hoặc minh chứng hình ảnh tập Gym/Yoga tối thiểu 03 tháng, thể hiện rõ thời gian luyện tập."
        ],

      specialRules: [
        "Không tính giải thể thao điện tử.",
        "Thời gian luyện tập tối thiểu 03 tháng phải được thể hiện rõ trên giấy tờ.",
        "CLB thể thao phải từ cấp Khoa trở lên hoặc có xác nhận hợp lệ."
      ],

      aiRules: {
        requireOneEvidence: true,
        minTrainingMonths: 3,
        excludeEsports: true
      }
    },

    tinhNguyenTot: {
      title: "Tình nguyện tốt - Cấp Trường",
      label: "Tình nguyện tốt",

      rule: "Đạt ít nhất 01 trong các tiêu chuẩn tình nguyện.",

      mandatory: [
        "Tham gia ít nhất 05 ngày tình nguyện trong năm học theo hướng dẫn tính ngày tình nguyện hiện hành của BCH Hội Sinh viên Việt Nam Trường.",
        "Hoặc đạt khen thưởng từ cấp Trường trở lên về hoạt động tình nguyện."
      ],

      batBuoc: [
        "Đạt ít nhất 01 trong 02 tiêu chuẩn: tham gia ít nhất 05 ngày tình nguyện trong năm học hoặc đạt khen thưởng từ cấp Trường trở lên về hoạt động tình nguyện."
        ],

      evidenceTypes: [
        "Giấy xác nhận số ngày tình nguyện từ BCH Hội Sinh viên Trường hoặc Liên chi Hội.",
        "Giấy chứng nhận tham gia chiến dịch tình nguyện như Mùa hè xanh, Xuân tình nguyện, Tiếp sức mùa thi hoặc hoạt động tình nguyện khác.",
        "Giấy chứng nhận hiến máu nhân đạo nếu được tính theo hướng dẫn hiện hành.",
        "Giấy khen hoặc quyết định khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên."
      ],

      minhChung: [
        "Giấy xác nhận số ngày tình nguyện.",
        "Giấy chứng nhận tham gia chiến dịch tình nguyện như Mùa hè xanh, Xuân tình nguyện, Tiếp sức mùa thi hoặc hoạt động tình nguyện khác.",
        "Giấy chứng nhận hiến máu nhân đạo nếu được tính theo hướng dẫn hiện hành.",
        "Giấy khen hoặc quyết định khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên."
        ],

      volunteerRules: [
        "Có thể cộng dồn nhiều minh chứng để đủ 05 ngày tình nguyện.",
        "Nếu admin đã upload hoạt động tình nguyện có số ngày, hệ thống cộng với minh chứng sinh viên tự upload.",
        "Giấy chứng nhận nên thể hiện rõ số ngày tình nguyện.",
        "Nếu giấy chứng nhận chiến dịch chỉ xác nhận tham gia chung và không ghi số ngày, hệ thống có thể chỉ tính tối đa 01 ngày theo logic cấu hình.",
        "Nếu là giấy khen/khen thưởng từ cấp Trường trở lên về tình nguyện thì có thể đạt tiêu chí dù không ghi số ngày."
      ],

      aiRules: {
        volunteerDaysRequired: 5,
        allowAccumulation: true,
        genericCampaignCertificateMaxDays: 1,
        awardCanPassDirectly: true
      }
    },

    hoiNhapTot: {
      title: "Hội nhập tốt - Cấp Trường",
      label: "Hội nhập tốt",

      requiredGroups: ["ngoaiNgu", "kyNang", "hoiNhap"],

      rules: [
        "Cần đạt đủ 03 nhóm: Ngoại ngữ, Kỹ năng và Hoạt động hội nhập.",
        "Mỗi nhóm cần ít nhất 01 minh chứng hợp lệ."
      ],

      mandatory: [
        "Đạt ít nhất 01 tiêu chuẩn thuộc nhóm Ngoại ngữ.",
        "Đạt ít nhất 01 tiêu chuẩn thuộc nhóm Kỹ năng.",
        "Đạt ít nhất 01 tiêu chuẩn thuộc nhóm Hoạt động hội nhập."
      ],

      batBuoc: [
        "Đạt ít nhất 01 tiêu chuẩn thuộc nhóm Ngoại ngữ.",
        "Đạt ít nhất 01 tiêu chuẩn thuộc nhóm Kỹ năng.",
        "Đạt ít nhất 01 tiêu chuẩn thuộc nhóm Hoạt động hội nhập."
        ],

      subCriteria: {
        ngoaiNgu: {
          title: "Ngoại ngữ",
          evidenceTypes: [
            "Đạt chứng chỉ tiếng Anh trình độ B1 hoặc tương đương B1 trở lên.",
            "Đạt chứng chỉ ngoại ngữ khác ở trình độ tương đương B1 trở lên.",
            "Tổng điểm các học phần ngoại ngữ, trừ môn ngoại ngữ chuyên ngành, tích lũy từ năm nhất tới thời điểm xét đạt từ 3.4/4.0 trở lên hoặc từ 8.5/10 trở lên.",
            "Đạt giấy chứng nhận trình độ B1 hoặc tương đương B1 trở lên trong các cuộc thi thử tiếng Anh do các trung tâm ngoại ngữ tổ chức nếu quy chế cấp Trường cho phép.",
            "Tham gia và vượt qua vòng đầu tiên hoặc là thành viên Ban Tổ chức cuộc thi kiến thức ngoại ngữ từ cấp Khoa trở lên."
          ],
          equivalents: B1_EQUIVALENTS
        },

        kyNang: {
          title: "Kỹ năng",
          evidenceTypes: [
            "Giấy chứng nhận hoàn thành ít nhất 01 khóa kỹ năng thực hành xã hội.",
            "Đạt giải trong các cuộc thi về kỹ năng từ cấp Khoa trở lên.",
            "Là báo cáo viên các lớp kỹ năng từ cấp Khoa hoặc tương đương trở lên, có giấy xác nhận.",
            "Được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về thành tích xuất sắc trong công tác Đoàn và phong trào thanh niên hoặc công tác Hội và phong trào sinh viên.",
            "Tham gia vào vòng Chung kết các cuộc thi về thủ lĩnh sinh viên cấp Trường trở lên."
          ]
        },

        hoiNhap: {
          title: "Hoạt động hội nhập",
          evidenceTypes: [
            "Giấy chứng nhận tham gia ít nhất 01 hoạt động giao lưu quốc tế như hội nghị, hội thảo quốc tế, chương trình gặp gỡ, giao lưu, hợp tác với thanh niên, sinh viên quốc tế trong và ngoài nước.",
            "Tham gia và vượt qua vòng đầu tiên hoặc là thành viên Ban Tổ chức các hoạt động, cuộc thi tìm hiểu về kiến thức văn hóa, hội nhập từ cấp Khoa trở lên.",
            "Là thành viên chính thức tham gia các chương trình giao lưu, hợp tác với thanh niên, sinh viên quốc tế trong và ngoài nước.",
            "Sinh viên làm tình nguyện viên theo đoàn hoặc thành viên chính thức tham gia chương trình giao lưu, hợp tác với thanh niên, sinh viên quốc tế."
          ]
        }
      },

      evidenceTypes: [
        "Chứng chỉ ngoại ngữ tương đương B1 trở lên.",
        "Bảng điểm học phần ngoại ngữ đạt yêu cầu.",
        "Chứng nhận hoàn thành khóa kỹ năng thực hành xã hội.",
        "Giấy chứng nhận tham gia hoạt động giao lưu quốc tế.",
        "Giấy khen hoặc xác nhận liên quan đến hoạt động hội nhập."
      ],

      minhChung: [
        "Nhóm Ngoại ngữ: Chứng chỉ tiếng Anh trình độ B1 hoặc tương đương B1 trở lên còn thời hạn.",
        "Nhóm Ngoại ngữ: Chứng chỉ ngoại ngữ khác ở trình độ tương đương B1 trở lên còn thời hạn.",
        "Nhóm Ngoại ngữ: Bảng điểm hoặc xác nhận điểm các học phần ngoại ngữ tích lũy từ năm nhất đến thời điểm xét đạt từ 3.4/4.0 hoặc từ 8.5/10 trở lên.",
        "Nhóm Ngoại ngữ: Giấy chứng nhận trình độ B1 hoặc tương đương B1 trở lên trong các cuộc thi thử tiếng Anh do trung tâm ngoại ngữ tổ chức.",
        "Nhóm Ngoại ngữ: Minh chứng tham gia và vượt qua vòng đầu tiên hoặc là thành viên Ban Tổ chức cuộc thi kiến thức ngoại ngữ từ cấp Khoa trở lên.",

        "Nhóm Kỹ năng: Giấy chứng nhận hoàn thành ít nhất 01 khóa trang bị kỹ năng thực hành xã hội.",
        "Nhóm Kỹ năng: Minh chứng đạt giải trong các cuộc thi về kỹ năng từ cấp Khoa trở lên.",
        "Nhóm Kỹ năng: Giấy xác nhận là báo cáo viên các lớp kỹ năng từ cấp Khoa hoặc tương đương trở lên.",
        "Nhóm Kỹ năng: Giấy khen hoặc minh chứng được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về thành tích trong công tác Đoàn, phong trào thanh niên, công tác Hội hoặc phong trào sinh viên.",
        "Nhóm Kỹ năng: Minh chứng tham gia và vào vòng Chung kết các cuộc thi về thủ lĩnh sinh viên cấp Trường trở lên.",

        "Nhóm Hoạt động hội nhập: Giấy chứng nhận tham gia ít nhất 01 hoạt động giao lưu quốc tế, hội nghị quốc tế, hội thảo quốc tế hoặc chương trình gặp gỡ, giao lưu, hợp tác với thanh niên, sinh viên quốc tế.",
        "Nhóm Hoạt động hội nhập: Minh chứng tham gia và vượt qua vòng đầu tiên hoặc là thành viên Ban Tổ chức các hoạt động, cuộc thi tìm hiểu kiến thức văn hóa, hội nhập từ cấp Khoa trở lên.",
        "Nhóm Hoạt động hội nhập: Giấy xác nhận là thành viên chính thức tham gia chương trình giao lưu, hợp tác với thanh niên, sinh viên quốc tế trong và ngoài nước.",
        "Nhóm Hoạt động hội nhập: Giấy xác nhận là tình nguyện viên theo đoàn hoặc thành viên chính thức tham gia chương trình giao lưu, hợp tác với thanh niên, sinh viên quốc tế trong và ngoài nước."
     ],

      aiRules: {
        requiredGroups: ["ngoaiNgu", "kyNang", "hoiNhap"],
        requireAllGroups: true
      }
    },

    collective: {
      title: "Tập thể Sinh viên 5 tốt cấp Trường",
      object: "Chi Hội/Lớp sinh viên trong hệ thống cấp Trường.",
      criteria: [
        "Đánh giá chất lượng Chi Hội cuối năm xếp loại Mạnh.",
        "Có hình thức cụ thể để sinh viên đăng ký phấn đấu trở thành Sinh viên 5 tốt.",
        "Có hoạt động tạo môi trường cho sinh viên phấn đấu đạt danh hiệu Sinh viên 5 tốt.",
        "Chi Hội dưới 100 sinh viên cần ít nhất 30% sinh viên đạt danh hiệu Sinh viên 5 tốt.",
        "Chi Hội từ 100 sinh viên trở lên cần ít nhất 15% sinh viên đạt danh hiệu Sinh viên 5 tốt.",
        "Không có sinh viên vi phạm pháp luật, quy chế, nội quy."
      ],
      aiRules: {
        requiredPercentUnder100: 30,
        requiredPercentFrom100: 15
      }
    }
  },

  // =====================================================
  // CẤP ĐHQG-HCM
  // Theo Quyết định 48-QĐ/BCSP ngày 21/4/2023
  // =====================================================
  [AWARD_LEVELS.DHQG]: {
    common: {
      title: "Sinh viên 5 tốt cấp ĐHQG-HCM",
      required: [
        "Đạt danh hiệu Sinh viên 5 tốt cấp Trường."
      ]
    },

    daoDucTot: {
      title: "Đạo đức tốt - Cấp ĐHQG-HCM",
      label: "Đạo đức tốt",

      mandatory: [
        "Có lòng yêu nước, trung thành với mục tiêu, lý tưởng cách mạng của Đảng.",
        "Không vi phạm pháp luật và các quy chế, nội quy của trường, lớp, quy định của địa phương cư trú, nơi công cộng.",
        "Điểm rèn luyện đạt từ 80 điểm trở lên trên thang điểm 100 theo quy chế đánh giá kết quả rèn luyện sinh viên hiện hành.",
        "Đối với các trường đặc thù không đánh giá rèn luyện theo quy chế hiện hành thì mức xếp loại rèn luyện phải đạt Xuất sắc.",
        "Đánh giá chất lượng Đoàn viên cuối năm, đối với Hội viên là Đoàn viên, đạt Hoàn thành xuất sắc nhiệm vụ.",
        "Đối với đơn vị có đánh giá chất lượng Hội viên thì kết quả đánh giá chất lượng cũng phải đạt Hoàn thành xuất sắc nhiệm vụ."
      ],

      batBuoc: [
        "Phải đã đạt danh hiệu Sinh viên 5 tốt cấp Trường.",
        "Điểm rèn luyện đạt từ 80/100 trở lên hoặc xếp loại rèn luyện Xuất sắc đối với trường đặc thù.",
        "Không vi phạm pháp luật, quy chế, nội quy của trường, lớp, địa phương cư trú và nơi công cộng.",
        "Đánh giá chất lượng Đoàn viên/Hội viên cuối năm đạt Hoàn thành xuất sắc nhiệm vụ."
        ],

      evidenceTypes: [
        "Minh chứng điểm rèn luyện từ 80/100 trở lên hoặc xác nhận xếp loại rèn luyện Xuất sắc.",
        "Minh chứng đánh giá Đoàn viên/Hội viên Hoàn thành xuất sắc nhiệm vụ.",
        "Minh chứng không vi phạm pháp luật, quy chế, nội quy nếu đơn vị yêu cầu."
      ],

      minhChung: [
        "Dữ liệu điểm rèn luyện đã khai ở cấp Trường.",
        "Kết quả đánh giá Đoàn viên/Hội viên cuối năm.",
        "Xác nhận không vi phạm pháp luật, quy chế, nội quy nếu đơn vị yêu cầu.",
        "Minh chứng đã đạt danh hiệu Sinh viên 5 tốt cấp Trường."
        ],

      aiRules: {
        selfDeclareFromSchoolLevel: true,
        skipAI: true,
        trainingScoreRequired: 80,
        requireNoViolation: true,
        requireExcellentUnionMember: true
      }
    },

    hocTapTot: {
      title: "Học tập tốt - Cấp ĐHQG-HCM",
      label: "Học tập tốt",

      mandatory: [
        "Có động cơ, thái độ học tập đúng đắn.",
        "Không gian lận trong thi cử, không nợ môn, học phần hoặc tín chỉ trong năm học.",
        "Điểm trung bình chung học tập cả năm học đạt từ 8.0/10 trở lên hoặc từ 3.2/4.0 trở lên.",
        "Hội đồng xét chọn có thể xem xét thêm đối với trường hợp chưa đạt điểm trung bình chung học tập cả năm như trên nhưng đạt học bổng khuyến khích học tập của nhà trường, được Ban Thư ký Hội Sinh viên Trường thống nhất giới thiệu."
      ],

      batBuoc: [
        "Phải đã đạt danh hiệu Sinh viên 5 tốt cấp Trường.",
        "GPA cả năm đạt từ 8.0/10 trở lên hoặc từ 3.2/4.0 trở lên.",
        "Không nợ môn, học phần hoặc tín chỉ trong năm học.",
        "Không gian lận trong thi cử.",
        "Có động cơ, thái độ học tập đúng đắn.",
        "Đạt thêm ít nhất 01 tiêu chuẩn học thuật khác theo quy chế cấp ĐHQG-HCM."
        ],


      otherRequiredRule: "Đạt ít nhất 01 tiêu chuẩn học thuật khác.",

      evidenceTypes: [
        "Có đề tài nghiên cứu khoa học sinh viên hoặc khóa luận tốt nghiệp trong năm học được hội đồng khoa học cấp Trường nghiệm thu đánh giá từ 7.0 điểm hoặc loại Khá trở lên, hoặc đạt giải cấp Trường trở lên.",
        "Đạt giải Ba trở lên trong các cuộc thi học thuật, cuộc thi ý tưởng sáng tạo, giải thưởng Euréka, cuộc thi sinh viên nghiên cứu khoa học từ cấp Khoa/Bộ môn trở lên, thuộc danh mục do Đoàn Thanh niên hoặc Hội Sinh viên Trường xác nhận.",
        "Trường hợp cuộc thi không nằm trong danh mục sẽ được Hội đồng xem xét riêng.",
        "Có bài viết đăng trên các tạp chí chuyên ngành hoặc có bài tham luận tham gia hội thảo khoa học được bảo trợ nội dung bởi các cơ quan chuyên môn từ cấp Trường trở lên.",
        "Có sản phẩm sáng tạo, giải pháp hữu ích được cấp bằng sáng chế hoặc đã được chấp nhận đơn đăng ký chứng nhận quyền sở hữu trí tuệ, cấp giấy phép xuất bản.",
        "Là thành viên đội tuyển tham gia các cuộc thi học thuật cấp quốc gia, quốc tế."
      ],

     minhChung: [
        "Dữ liệu GPA, tình trạng nợ môn, vi phạm học tập và thái độ học tập đã khai ở cấp Trường.",
        "Minh chứng đề tài nghiên cứu khoa học sinh viên hoặc khóa luận tốt nghiệp được Hội đồng khoa học cấp Trường nghiệm thu đánh giá từ 7.0 điểm hoặc loại Khá trở lên, hoặc đạt giải cấp Trường trở lên.",
        "Minh chứng đạt giải Ba trở lên trong cuộc thi học thuật, cuộc thi ý tưởng sáng tạo, giải thưởng Euréka hoặc cuộc thi sinh viên nghiên cứu khoa học từ cấp Khoa/Bộ môn trở lên.",
        "Minh chứng bài viết đăng trên tạp chí chuyên ngành hoặc bài tham luận hội thảo khoa học được bảo trợ nội dung bởi cơ quan chuyên môn từ cấp Trường trở lên.",
        "Minh chứng sản phẩm sáng tạo, giải pháp hữu ích, bằng sáng chế hoặc đơn đăng ký chứng nhận quyền sở hữu trí tuệ.",
        "Minh chứng là thành viên đội tuyển tham gia cuộc thi học thuật cấp quốc gia hoặc quốc tế."
        ],

      aiRules: {
        mandatorySelfDeclareFromSchoolLevel: true,
        evidenceOnlyForExtraCriteria: true,
        gpa10Required: 8.0,
        gpa4Required: 3.2,
        researchScoreRequired: 7.0,
        researchGradeRequired: "Khá",
        prizeMinimum: "Giải Ba",
        directTypes: DIRECT_HOC_TAP_TYPES,
        academicActivityCountRequired: null
      }
    },

    theLucTot: {
      title: "Thể lực tốt - Cấp ĐHQG-HCM",
      label: "Thể lực tốt",

      rule: "Đạt ít nhất 01 trong những tiêu chuẩn thể lực.",

      mandatory: [
        "Đạt ít nhất 01 tiêu chuẩn thể lực hợp lệ theo quy chế cấp ĐHQG-HCM."
      ],

      batBuoc: [
        "Phải đã đạt danh hiệu Sinh viên 5 tốt cấp Trường.",
        "Đạt ít nhất 01 tiêu chuẩn thể lực hợp lệ theo quy chế cấp ĐHQG-HCM."
        ],

      evidenceTypes: [
        "Tham gia các hoạt động sát hạch thể lực và đạt danh hiệu Thanh niên khỏe từ cấp Trường trở lên theo Phụ lục I.",
        "Tham gia các hoạt động thể thao cấp ĐHQG-HCM, cấp Thành phố hoặc cấp Trung ương.",
        "Tham gia và đạt giải tại các hoạt động thể thao từ cấp Trường trở lên, trừ các giải thể thao điện tử.",
        "Là thành viên chính thức đội tuyển cấp Trường trở lên ở các môn thể dục thể thao.",
        "Tham gia tập luyện thường xuyên một môn thể thao tại các trung tâm thể dục - thể thao, có giấy chứng nhận của nơi tập luyện thời gian tối thiểu 06 tháng tính đến thời điểm xét danh hiệu, kèm minh chứng bằng hình ảnh tại các thời điểm khác nhau."
      ],

      minhChung: [
        "Giấy chứng nhận Thanh niên khỏe từ cấp Trường trở lên.",
        "Giấy chứng nhận tham gia hoặc thành tích tại hoạt động thể thao cấp ĐHQG-HCM, cấp Thành phố hoặc cấp Trung ương.",
        "Giấy chứng nhận hoặc giải thưởng thể thao từ cấp Trường trở lên, trừ thể thao điện tử.",
        "Xác nhận là thành viên chính thức đội tuyển thể thao cấp Trường trở lên.",
        "Giấy chứng nhận luyện tập thường xuyên một môn thể thao tại trung tâm thể dục - thể thao tối thiểu 06 tháng, kèm minh chứng hình ảnh tại các thời điểm khác nhau."
        ],

      specialRules: [
        "Sinh viên khuyết tật không bắt buộc xét tiêu chuẩn về thể lực.",
        "Không tính giải thể thao điện tử.",
        "Minh chứng luyện tập thể thao cần thể hiện thời gian tối thiểu 06 tháng."
      ],

      aiRules: {
        requireOneEvidence: true,
        minTrainingMonths: 6,
        excludeEsports: true,
        disabledStudentExempted: true
      }
    },

    tinhNguyenTot: {
      title: "Tình nguyện tốt - Cấp ĐHQG-HCM",
      label: "Tình nguyện tốt",

      rule: "Đạt ít nhất 01 trong những tiêu chuẩn tình nguyện.",

      mandatory: [
        "Được khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên.",
        "Hoặc tham gia ít nhất 05 ngày tình nguyện/năm, tính theo số ngày thực tế tham gia các hoạt động tình nguyện cộng dồn."
      ],

      batBuoc: [
        "Phải đã đạt danh hiệu Sinh viên 5 tốt cấp Trường.",
        "Đạt ít nhất 01 trong các tiêu chuẩn: có khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên hoặc tham gia ít nhất 05 ngày tình nguyện/năm."
        ],

      evidenceTypes: [
        "Giấy khen/khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên.",
        "Giấy xác nhận tham gia ít nhất 05 ngày tình nguyện/năm.",
        "Giấy chứng nhận tham gia chiến dịch tình nguyện.",
        "Giấy chứng nhận hiến máu tình nguyện nếu được tính theo hướng dẫn."
      ],

      minhChung: [
        "Giấy khen hoặc quyết định khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên.",
        "Giấy xác nhận tham gia ít nhất 05 ngày tình nguyện trong năm học.",
        "Giấy chứng nhận tham gia chiến dịch tình nguyện, có thể hiện rõ số ngày nếu dùng để tính ngày.",
        "Giấy chứng nhận hiến máu tình nguyện nếu được tính theo hướng dẫn.",
        "Các minh chứng tình nguyện cộng dồn theo số ngày thực tế tham gia."
        ],

      volunteerRules: [
        "Số ngày tình nguyện được tính theo số ngày thực tế tham gia và có thể cộng dồn.",
        "Ví dụ: 03 ngày tình nguyện tại mái ấm nhà mở, 01 lần hiến máu tình nguyện, 01 ngày Chủ nhật xanh ở các thời điểm khác nhau trong năm thì được tính là đủ tiêu chuẩn.",
        "Khuyến khích tham gia ít nhất 01 chiến dịch tình nguyện trong năm.",
        "Giấy chứng nhận tham gia phải thể hiện rõ số ngày tình nguyện.",
        "Nếu giấy chứng nhận chiến dịch tình nguyện chỉ xác nhận tham gia chung và không ghi số ngày thì chỉ tính tối đa 01 ngày.",
        "Danh mục hoạt động tình nguyện gồm: xây dựng nông thôn mới, văn minh đô thị, bảo vệ môi trường, ứng phó biến đổi khí hậu, đảm bảo trật tự an toàn giao thông, đảm bảo an sinh xã hội, hướng dẫn hành chính, hỗ trợ khởi nghiệp lập nghiệp và các hoạt động khác do Hội đồng xem xét."
      ],

      aiRules: {
        volunteerDaysRequired: 5,
        allowAccumulation: true,
        genericCampaignCertificateMaxDays: 1,
        awardCanPassDirectly: true
      }
    },

    hoiNhapTot: {
      title: "Hội nhập tốt - Cấp ĐHQG-HCM",
      label: "Hội nhập tốt",

      requiredGroups: ["ngoaiNgu", "hoiNhap", "kyNang"],

      rules: [
        "Cần xét đủ 03 nhóm: Ngoại ngữ, Hội nhập và Kỹ năng."
      ],

      mandatory: [
        "Đạt nhóm Ngoại ngữ theo quy chế cấp ĐHQG-HCM.",
        "Đạt nhóm Hội nhập theo quy chế cấp ĐHQG-HCM.",
        "Đạt nhóm Kỹ năng theo quy chế cấp ĐHQG-HCM."
      ],

      batBuoc: [
        "Phải đã đạt danh hiệu Sinh viên 5 tốt cấp Trường.",
        "Đạt nhóm Ngoại ngữ theo quy chế cấp ĐHQG-HCM.",
        "Đạt nhóm Hội nhập theo quy chế cấp ĐHQG-HCM.",
        "Đạt nhóm Kỹ năng theo quy chế cấp ĐHQG-HCM."
        ],

      subCriteria: {
        ngoaiNgu: {
          title: "5.1. Về ngoại ngữ",
          evidenceTypes: [
            "Đạt chứng chỉ tiếng Anh trình độ B1 theo khung tham chiếu châu Âu hoặc tương đương B1, hoặc chứng chỉ ngoại ngữ khác ở trình độ tương đương trở lên còn thời hạn.",
            "Tổng điểm các học phần ngoại ngữ, trừ môn ngoại ngữ chuyên ngành, tích lũy từ năm nhất tới thời điểm xét đạt từ 3.4/4.0 trở lên hoặc từ 8.5/10 trở lên.",
            "Đối tượng sinh viên chuyên ngành Ngoại ngữ: chứng chỉ Ngoại ngữ được áp dụng với môn Ngoại ngữ 2."
          ],
          notes: [
            "Áp dụng quy đổi chứng chỉ IELTS, TOEFL, TOEIC và một số chứng chỉ khác theo quy định liên quan.",
            "Không chấp nhận chứng nhận trong các đợt thi thử."
          ],
          equivalents: B1_EQUIVALENTS
        },

        hoiNhap: {
          title: "5.2. Về hội nhập",
          rule: "Đạt 01 trong các tiêu chí hội nhập.",
          evidenceTypes: [
            "Đạt giấy chứng nhận tham gia ít nhất 01 hoạt động giao lưu quốc tế: hội nghị, hội thảo quốc tế, các chương trình gặp gỡ, giao lưu, hợp tác với thanh niên, sinh viên quốc tế trong và ngoài nước.",
            "Đạt giải Ba trở lên tại các cuộc thi về kiến thức hội nhập hoặc các cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên.",
            "Sinh viên làm tình nguyện viên theo đoàn, thành viên chính thức tham gia các chương trình giao lưu, hợp tác với thanh niên, sinh viên quốc tế trong và ngoài nước."
          ]
        },

        kyNang: {
          title: "5.3. Về kỹ năng",
          rule: "Đạt 01 trong các tiêu chí kỹ năng.",
          evidenceTypes: [
            "Đạt giấy chứng nhận hoàn thành ít nhất 01 khóa trang bị kỹ năng thực hành xã hội, khuyến khích theo khung kỹ năng thực hành xã hội căn cứ theo Phụ lục III.",
            "Đạt giải trong các cuộc thi về kỹ năng từ cấp Trường trở lên.",
            "Là báo cáo viên các lớp kỹ năng từ cấp Trường trở lên.",
            "Được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về thành tích xuất sắc trong công tác Đoàn và phong trào thanh niên hoặc công tác Hội và phong trào sinh viên."
          ]
        }
      },

      evidenceTypes: [
        "Chứng chỉ ngoại ngữ hoặc bảng điểm học phần ngoại ngữ đạt chuẩn.",
        "Giấy chứng nhận hoạt động giao lưu quốc tế, hội nghị, hội thảo quốc tế.",
        "Minh chứng đạt giải cuộc thi hội nhập hoặc cuộc thi học thuật bằng ngoại ngữ.",
        "Giấy chứng nhận hoàn thành khóa kỹ năng.",
        "Giấy khen hoặc xác nhận liên quan đến công tác Đoàn - Hội, kỹ năng, hội nhập."
      ],

      minhChung: [
        "Nhóm Ngoại ngữ: Chứng chỉ tiếng Anh trình độ B1 theo khung tham chiếu châu Âu hoặc tương đương B1 trở lên còn thời hạn.",
        "Nhóm Ngoại ngữ: Chứng chỉ ngoại ngữ khác ở trình độ tương đương B1 trở lên còn thời hạn.",
        "Nhóm Ngoại ngữ: Bảng điểm học phần ngoại ngữ tích lũy, trừ môn ngoại ngữ chuyên ngành, đạt từ 3.4/4.0 hoặc từ 8.5/10 trở lên.",
        "Nhóm Ngoại ngữ: Không chấp nhận chứng nhận trong các đợt thi thử.",

        "Nhóm Hoạt động hội nhập: Giấy chứng nhận tham gia ít nhất 01 hoạt động giao lưu quốc tế, hội nghị, hội thảo quốc tế hoặc chương trình gặp gỡ, giao lưu, hợp tác với thanh niên, sinh viên quốc tế.",
        "Nhóm Hoạt động hội nhập: Minh chứng đạt giải Ba trở lên tại cuộc thi kiến thức hội nhập từ cấp Trường trở lên.",
        "Nhóm Hoạt động hội nhập: Minh chứng đạt giải Ba trở lên tại cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên.",
        "Nhóm Hoạt động hội nhập: Giấy xác nhận là tình nguyện viên theo đoàn hoặc thành viên chính thức tham gia chương trình giao lưu, hợp tác với thanh niên, sinh viên quốc tế.",

        "Nhóm Kỹ năng: Giấy chứng nhận hoàn thành ít nhất 01 khóa trang bị kỹ năng thực hành xã hội.",
        "Nhóm Kỹ năng: Minh chứng đạt giải trong cuộc thi kỹ năng từ cấp Trường trở lên.",
        "Nhóm Kỹ năng: Giấy xác nhận là báo cáo viên lớp kỹ năng từ cấp Trường trở lên.",
        "Nhóm Kỹ năng: Giấy khen hoặc minh chứng được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về công tác Đoàn, phong trào thanh niên, công tác Hội hoặc phong trào sinh viên."
        ],

      aiRules: {
        requiredGroups: ["ngoaiNgu", "hoiNhap", "kyNang"],
        requireAllGroups: true
      }
    },

    collective: {
      title: "Tập thể Sinh viên 5 tốt cấp ĐHQG-HCM",
      object: "Liên Chi hội, Chi hội, Liên Chi đoàn, Chi đoàn đối với các đơn vị chưa có tổ chức Hội Sinh viên.",
      criteria: [
        "Đạt danh hiệu Tập thể Sinh viên 5 tốt cấp Trường.",
        "Có 100% sinh viên đăng ký tham gia phong trào Sinh viên 5 tốt.",
        "Có ít nhất 02 sinh viên đạt danh hiệu Sinh viên 5 tốt cấp ĐHQG-HCM hoặc 01 sinh viên đạt danh hiệu Sinh viên 5 tốt cấp Thành phố.",
        "Có ít nhất 30% sinh viên đạt danh hiệu Sinh viên 5 tốt cấp Trường.",
        "Không có sinh viên vi phạm pháp luật, các quy chế, nội quy của nhà trường, quy định của địa phương cư trú và cộng đồng."
      ],
      aiRules: {
        requireSchoolCollectiveTitle: true,
        registrationRateRequired: 100,
        minDhqgStudents: 2,
        alternativeMinThanhStudents: 1,
        minSchoolSv5tPercent: 30,
        requireNoViolation: true
      }
    }
  },

  // =====================================================
  // CẤP THÀNH PHỐ HỒ CHÍ MINH
  // Theo Quyết định 08/QĐ-BTK ngày 18/5/2022
  // =====================================================
  [AWARD_LEVELS.THANH]: {
    common: {
      title: "Sinh viên 5 tốt cấp Thành phố Hồ Chí Minh",
      required: [
        "Đạt danh hiệu Sinh viên 5 tốt cấp Trường."
      ]
    },

    daoDucTot: {
      title: "Đạo đức tốt - Cấp Thành phố",
      label: "Đạo đức tốt",

      mandatory: [
        "Có lòng yêu nước, trung thành với mục tiêu, lý tưởng cách mạng của Đảng.",
        "Không vi phạm pháp luật và các quy chế, nội quy của trường, lớp, quy định của địa phương cư trú, nơi công cộng.",
        "Điểm rèn luyện đạt từ 90 điểm trở lên trên thang điểm 100 theo quy chế đánh giá kết quả rèn luyện sinh viên hiện hành.",
        "Đối với những trường đặc thù không đánh giá kết quả rèn luyện sinh viên theo quy chế hiện hành thì mức xếp loại rèn luyện phải đạt Xuất sắc.",
        "Đánh giá chất lượng Đoàn viên cuối năm, đối với Hội viên là Đoàn viên, đạt Hoàn thành xuất sắc nhiệm vụ.",
        "Đối với đơn vị có đánh giá chất lượng Hội viên thì kết quả đánh giá chất lượng cũng phải đạt Hoàn thành xuất sắc nhiệm vụ."
      ],

      batBuoc: [
        "Phải đã đạt danh hiệu Sinh viên 5 tốt cấp Trường.",
        "Điểm rèn luyện đạt từ 90/100 trở lên hoặc xếp loại rèn luyện Xuất sắc đối với trường đặc thù.",
        "Không vi phạm pháp luật, quy chế, nội quy của trường, lớp, địa phương cư trú và nơi công cộng.",
        "Đánh giá chất lượng Đoàn viên/Hội viên cuối năm đạt Hoàn thành xuất sắc nhiệm vụ.",
        "Đạt thêm ít nhất 01 tiêu chuẩn đạo đức khác theo quy chế cấp Thành phố."
        ],

      otherRequiredRule: "Đạt ít nhất 01 tiêu chuẩn đạo đức khác.",

      evidenceTypes: [
        "Là thành viên chính thức đội thi tìm hiểu về chủ nghĩa Mác - Lênin, tư tưởng Hồ Chí Minh từ cấp Trường trở lên.",
        "Có tham luận, bài viết được trình bày tại các diễn đàn học thuật về các môn khoa học Mác - Lênin, tư tưởng Hồ Chí Minh từ cấp Trường trở lên.",
        "Là Thanh niên tiên tiến làm theo lời Bác hoặc là điển hình được biểu dương trong học tập và làm theo tư tưởng, tấm gương đạo đức, phong cách Chủ tịch Hồ Chí Minh.",
        "Có hành động dũng cảm cứu người bị nạn, bắt cướp, giúp người neo đơn, người nghèo, người gặp khó khăn, hoạn nạn trong tình trạng nguy hiểm và cấp thiết, được ghi nhận, biểu dương từ cấp Thành, ĐHQG TP. Hồ Chí Minh, Ủy ban nhân dân cấp huyện hoặc Đảng ủy, Ban Giám hiệu Nhà trường trở lên."
      ],

      minhChung: [
        "Dữ liệu điểm rèn luyện đã khai ở cấp Trường.",
        "Kết quả đánh giá Đoàn viên/Hội viên cuối năm.",
        "Xác nhận không vi phạm pháp luật, quy chế, nội quy nếu đơn vị yêu cầu.",
        "Minh chứng là thành viên chính thức đội thi tìm hiểu về chủ nghĩa Mác - Lênin, tư tưởng Hồ Chí Minh từ cấp Trường trở lên.",
        "Tham luận hoặc bài viết được trình bày tại diễn đàn học thuật về các môn khoa học Mác - Lênin, tư tưởng Hồ Chí Minh từ cấp Trường trở lên.",
        "Minh chứng Thanh niên tiên tiến làm theo lời Bác hoặc điển hình được biểu dương trong học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh.",
        "Giấy khen, xác nhận hoặc minh chứng hành động đẹp, hành động dũng cảm được ghi nhận, biểu dương theo quy chế cấp Thành phố."
        ],

      aiRules: {
        selfDeclareFromSchoolLevel: true,
        trainingScoreRequired: 90,
        requireNoViolation: true,
        requireExcellentUnionMember: true,
        requireOneAdditionalMoralEvidence: true
      }
    },

    hocTapTot: {
      title: "Học tập tốt - Cấp Thành phố",
      label: "Học tập tốt",

      mandatory: [
        "Có động cơ, thái độ học tập đúng đắn.",
        "Không gian lận trong thi cử, không nợ môn, học phần hoặc tín chỉ trong năm học.",
        "Đối với sinh viên các trường Đại học: điểm trung bình chung học tập cả năm học đạt từ 8.5/10 trở lên đối với các trường đào tạo theo niên chế hoặc từ 3.4/4.0 trở lên đối với các trường đào tạo theo học chế tín chỉ.",
        "Hội đồng xét chọn danh hiệu sẽ xem xét thêm đối với trường hợp chưa đạt điểm trung bình chung học tập cả năm như trên nhưng đạt học bổng khuyến khích học tập của nhà trường, được Ban Thư ký Hội Sinh viên Trường thống nhất giới thiệu."
      ],

      batBuoc: [
        "Phải đã đạt danh hiệu Sinh viên 5 tốt cấp Trường.",
        "Đối với sinh viên Đại học/Học viện: GPA cả năm đạt từ 8.5/10 trở lên hoặc từ 3.4/4.0 trở lên.",
        "Không nợ môn, học phần hoặc tín chỉ trong năm học.",
        "Không gian lận trong thi cử.",
        "Có động cơ, thái độ học tập đúng đắn.",
        "Đạt thêm ít nhất 01 tiêu chuẩn học thuật khác theo quy chế cấp Thành phố."
        ],

      otherRequiredRule: "Đạt ít nhất 01 tiêu chuẩn học thuật khác.",

      evidenceTypes: [
        "Có đề tài nghiên cứu khoa học sinh viên hoặc khóa luận tốt nghiệp trong năm học được hội đồng khoa học cấp Trường nghiệm thu đánh giá từ 8.0 điểm hoặc loại Tốt trở lên, hoặc đạt giải cấp Trường trở lên.",
        "Đạt giải Giải thưởng sinh viên nghiên cứu khoa học Euréka, giải thưởng nghiên cứu khoa học, cuộc thi ý tưởng sáng tạo hoặc các cuộc thi học thuật cấp Thành trở lên.",
        "Có bài viết đăng trên các tạp chí chuyên ngành hoặc có bài tham luận tham gia các hội thảo khoa học được bảo trợ nội dung bởi các cơ quan chuyên môn từ cấp Trường trở lên.",
        "Có sản phẩm sáng tạo, giải pháp hữu ích được cấp bằng sáng chế hoặc đã được chấp nhận đơn đăng ký chứng nhận quyền sở hữu trí tuệ, cấp giấy phép xuất bản.",
        "Là thành viên đội tuyển tham gia các cuộc thi học thuật cấp quốc gia, quốc tế.",
      ],

      minhChung: [
        "Dữ liệu GPA, tình trạng nợ môn, vi phạm học tập và thái độ học tập đã khai ở cấp Trường.",
        "Minh chứng đề tài nghiên cứu khoa học sinh viên hoặc khóa luận tốt nghiệp được Hội đồng khoa học cấp Trường nghiệm thu đánh giá từ 8.0 điểm hoặc loại Tốt trở lên, hoặc đạt giải cấp Trường trở lên.",
        "Minh chứng đạt giải Euréka, giải thưởng nghiên cứu khoa học, cuộc thi ý tưởng sáng tạo hoặc cuộc thi học thuật cấp Thành phố trở lên.",
        "Bài viết đăng trên tạp chí chuyên ngành hoặc bài tham luận hội thảo khoa học được bảo trợ nội dung bởi cơ quan chuyên môn từ cấp Trường trở lên.",
        "Minh chứng sản phẩm sáng tạo, giải pháp hữu ích, bằng sáng chế hoặc đơn đăng ký chứng nhận quyền sở hữu trí tuệ.",
        "Minh chứng là thành viên đội tuyển tham gia cuộc thi học thuật cấp quốc gia hoặc quốc tế.",
        ],

      aiRules: {
        mandatorySelfDeclareFromSchoolLevel: true,
        evidenceOnlyForExtraCriteria: true,
        gpa10RequiredUniversity: 8.5,
        gpa4RequiredUniversity: 3.4, 
        researchScoreRequired: 8.0,
        researchGradeRequired: "Tốt",
        prizeMinimum: "Cấp Thành trở lên",
        directTypes: DIRECT_HOC_TAP_TYPES
      }
    },

    theLucTot: {
      title: "Thể lực tốt - Cấp Thành phố",
      label: "Thể lực tốt",

      rule: "Đạt ít nhất 01 trong những tiêu chuẩn thể lực.",

      mandatory: [
        "Đạt ít nhất 01 tiêu chuẩn thể lực hợp lệ theo quy chế cấp Thành phố."
      ],

      batBuoc: [
        "Phải đã đạt danh hiệu Sinh viên 5 tốt cấp Trường.",
        "Đạt ít nhất 01 tiêu chuẩn thể lực hợp lệ theo quy chế cấp Thành phố."
        ],

      evidenceTypes: [
        "Tham gia các hoạt động sát hạch thể lực và đạt danh hiệu Thanh niên khỏe từ cấp Trường trở lên theo Phụ lục I.",
        "Tham gia các hoạt động thể thao cấp Thành phố, cấp Trung ương.",
        "Tham gia và đạt giải tại các hoạt động thể thao từ cấp Trường trở lên, trừ các giải thể thao điện tử.",
        "Là thành viên chính thức đội tuyển cấp Thành phố, cấp Quốc gia các môn thể dục thể thao."
      ],

      minhChung: [
        "Giấy chứng nhận Thanh niên khỏe từ cấp Trường trở lên.",
        "Giấy chứng nhận tham gia hoặc thành tích tại hoạt động thể thao cấp Thành phố hoặc cấp Trung ương.",
        "Giấy chứng nhận hoặc giải thưởng thể thao từ cấp Trường trở lên, trừ thể thao điện tử.",
        "Xác nhận là thành viên chính thức đội tuyển cấp Thành phố hoặc cấp Quốc gia."
        ],

      specialRules: [
        "Không tính giải thể thao điện tử.",
      ],

      aiRules: {
        requireOneEvidence: true,
        excludeEsports: true
      }
    },

    tinhNguyenTot: {
      title: "Tình nguyện tốt - Cấp Thành phố",
      label: "Tình nguyện tốt",

      rule: "Đạt ít nhất 01 trong những tiêu chuẩn tình nguyện.",

      mandatory: [
        "Được khen thưởng từ cấp Trường trở lên về hoạt động tình nguyện.",
        "Hoặc tham gia ít nhất 05 ngày tình nguyện/năm, tính theo số ngày thực tế tham gia các hoạt động tình nguyện cộng dồn."
      ],

      batBuoc: [
        "Phải đã đạt danh hiệu Sinh viên 5 tốt cấp Trường.",
        "Tham gia ít nhất 05 ngày tình nguyện trong năm học, tính theo số ngày thực tế tham gia và có thể cộng dồn.",
        "Có khen thưởng từ cấp Trường trở lên về hoạt động tình nguyện."
        ],

      evidenceTypes: [
        "Giấy khen/khen thưởng từ cấp Trường trở lên về hoạt động tình nguyện.",
        "Giấy xác nhận tham gia ít nhất 05 ngày tình nguyện/năm.",
        "Giấy chứng nhận tham gia chiến dịch tình nguyện.",
        "Giấy chứng nhận hiến máu tình nguyện nếu được tính theo hướng dẫn."
      ],

      minhChung: [
        "Giấy xác nhận số ngày tình nguyện, tối thiểu 05 ngày trong năm học.",
        "Giấy chứng nhận tham gia chiến dịch tình nguyện, có thể hiện rõ số ngày nếu dùng để tính ngày.",
        "Giấy chứng nhận hiến máu tình nguyện nếu được tính theo hướng dẫn.",
        "Giấy khen hoặc quyết định khen thưởng về hoạt động tình nguyện từ cấp Trường trở lên."
        ],

      volunteerRules: [
        "Số ngày tình nguyện được tính theo số ngày thực tế tham gia và có thể cộng dồn.",
        "Ví dụ: sinh viên tham gia 03 ngày tình nguyện tại mái ấm nhà mở, 01 lần hiến máu tình nguyện, 01 ngày Chủ nhật xanh ở các thời điểm khác nhau trong năm sẽ được tính là đủ tiêu chuẩn.",
        "Khuyến khích tham gia ít nhất 01 chiến dịch tình nguyện trong năm.",
        "Giấy chứng nhận tham gia phải thể hiện rõ việc tham gia bao nhiêu ngày tình nguyện.",
        "Nếu giấy chứng nhận chiến dịch tình nguyện chỉ ghi nhận tham gia chiến dịch và không thể hiện số ngày thì chỉ tính tối đa 01 ngày."
      ],

      aiRules: {
        volunteerDaysRequired: 5,
        allowAccumulation: true,
        genericCampaignCertificateMaxDays: 1,
        awardCanPassDirectly: true
      }
    },

    hoiNhapTot: {
      title: "Hội nhập tốt - Cấp Thành phố",
      label: "Hội nhập tốt",

      requiredGroups: ["ngoaiNgu", "hoiNhap", "kyNang"],

      rules: [
        "Cần xét các nhóm: Ngoại ngữ, điều kiện hội nhập đi kèm, Kỹ năng và Hoạt động hội nhập theo quy chế cấp Thành phố."
      ],

      mandatory: [
        "Đạt nhóm Ngoại ngữ theo quy chế cấp Thành phố.",
        "Đạt điều kiện hoạt động hội nhập đi kèm hoặc hoạt động hội nhập phù hợp.",
        "Đạt nhóm Kỹ năng theo quy chế cấp Thành phố."
      ],

      batBuoc: [
        "Phải đã đạt danh hiệu Sinh viên 5 tốt cấp Trường.",
        "Đạt nhóm Ngoại ngữ theo quy chế cấp Thành phố.",
        "Đạt nhóm Kỹ năng theo quy chế cấp Thành phố.",
        "Đạt nhóm Hoạt động hội nhập theo quy chế cấp Thành phố."
        ],

      subCriteria: {
        ngoaiNgu: {
          title: "5.1. Về ngoại ngữ",
          evidenceTypes: [
            "Đạt chứng chỉ tiếng Anh trình độ B1 theo khung tham chiếu châu Âu hoặc tương đương B1, hoặc chứng chỉ ngoại ngữ khác ở trình độ tương đương trở lên, không xét thời hạn của chứng chỉ.",
            "Tổng điểm các học phần ngoại ngữ, trừ môn ngoại ngữ chuyên ngành, tích lũy từ năm nhất tới thời điểm xét đạt từ 3.2/4.0 trở lên đối với các trường đào tạo theo học chế tín chỉ hoặc từ 8.0/10 trở lên đối với các trường đào tạo theo niên chế.",
          ],
          notes: [
            "Áp dụng quy đổi giá trị tương đương chứng chỉ IELTS, TOEFL, TOEIC và một số chứng chỉ khác theo quy định được dẫn trong quy chế."
          ],
          equivalents: B1_EQUIVALENTS
        },

        hoiNhap: {
          title: "Hoạt động hội nhập",
          rule: "Đạt minh chứng hội nhập phù hợp theo quy chế cấp Thành phố.",
          evidenceTypes: [
            "Đạt giấy chứng nhận tham gia ít nhất 01 hoạt động giao lưu quốc tế: hội nghị, hội thảo quốc tế, các chương trình gặp gỡ, giao lưu, hợp tác với thanh niên, sinh viên quốc tế trong và ngoài nước.",
            "Đạt giải Ba trở lên tại các cuộc thi về kiến thức hội nhập hoặc các cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên.",
            "Tham gia tích cực ít nhất 01 hoạt động về hội nhập do cấp Trường tổ chức trở lên."
          ]
        },

        kyNang: {
          title: "5.2. Về kỹ năng",
          rule: "Đạt 01 trong 02 tiêu chí kỹ năng.",
          evidenceTypes: [
            "Hoàn thành ít nhất 01 khóa trang bị kỹ năng thực hành xã hội, khuyến khích theo khung kỹ năng thực hành xã hội căn cứ theo Phụ lục II.",
            "Được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về thành tích xuất sắc trong công tác Đoàn và phong trào thanh niên hoặc công tác Hội và phong trào sinh viên."
          ]
        }
      },

      evidenceTypes: [
        "Chứng chỉ ngoại ngữ hoặc bảng điểm học phần ngoại ngữ đạt chuẩn.",
        "Giấy chứng nhận hoạt động giao lưu quốc tế, hội nghị, hội thảo quốc tế.",
        "Minh chứng đạt giải cuộc thi hội nhập hoặc cuộc thi học thuật bằng ngoại ngữ.",
        "Giấy chứng nhận hoàn thành khóa kỹ năng.",
        "Giấy khen hoặc xác nhận liên quan đến công tác Đoàn - Hội, kỹ năng, hội nhập.",
        "Minh chứng tham gia hoạt động hội nhập do cấp Trường tổ chức trở lên."
      ],

      minhChung: [
        "Nhóm Ngoại ngữ: Chứng chỉ tiếng Anh trình độ B1 theo khung tham chiếu châu Âu hoặc tương đương B1 trở lên.",
        "Nhóm Ngoại ngữ: Chứng chỉ ngoại ngữ khác ở trình độ tương đương B1 trở lên, không xét thời hạn chứng chỉ.",
        "Nhóm Ngoại ngữ: Bảng điểm học phần ngoại ngữ tích lũy, trừ môn ngoại ngữ chuyên ngành, đạt từ 3.2/4.0 hoặc từ 8.0/10 trở lên.",

        "Nhóm Kỹ năng: Giấy chứng nhận hoàn thành ít nhất 01 khóa trang bị kỹ năng thực hành xã hội.",
        "Nhóm Kỹ năng: Giấy khen hoặc minh chứng được Đoàn Thanh niên - Hội Sinh viên từ cấp Trường trở lên khen thưởng về công tác Đoàn, phong trào thanh niên, công tác Hội hoặc phong trào sinh viên.",

        "Nhóm Hoạt động hội nhập: Minh chứng tham gia tích cực ít nhất 01 hoạt động hội nhập do cấp Trường tổ chức trở lên.",
        "Nhóm Hoạt động hội nhập: Giấy chứng nhận tham gia hoạt động giao lưu quốc tế, hội nghị quốc tế, hội thảo quốc tế hoặc chương trình gặp gỡ, giao lưu, hợp tác với thanh niên, sinh viên quốc tế.",
        "Nhóm Hoạt động hội nhập: Minh chứng đạt giải Ba trở lên tại cuộc thi kiến thức hội nhập từ cấp Trường trở lên.",
        "Nhóm Hoạt động hội nhập: Minh chứng đạt giải Ba trở lên tại cuộc thi học thuật bằng ngoại ngữ từ cấp Trường trở lên."
        ],

      aiRules: {
        requiredGroups: ["ngoaiNgu", "hoiNhap", "kyNang"],
        requireAllGroups: true
      }
    },

    collective: {
      title: "Tập thể Sinh viên 5 tốt cấp Thành phố Hồ Chí Minh",
      object: "Liên Chi hội, Chi hội, Liên Chi đoàn, Chi đoàn đối với các trường chưa có tổ chức Hội Sinh viên.",
      criteria: [
        "Đạt danh hiệu Tập thể Sinh viên 5 tốt cấp Trường.",
        "Có 100% sinh viên đăng ký tham gia phong trào Sinh viên 5 tốt.",
        "Có ít nhất 01 sinh viên đạt danh hiệu Sinh viên 5 tốt cấp Thành phố.",
        "Có ít nhất 30% sinh viên đạt danh hiệu Sinh viên 5 tốt cấp Trường.",
        "Không có sinh viên vi phạm pháp luật, các quy chế, nội quy của nhà trường, quy định của địa phương cư trú và cộng đồng."
      ],
      aiRules: {
        requireSchoolCollectiveTitle: true,
        registrationRateRequired: 100,
        minThanhStudents: 1,
        minSchoolSv5tPercent: 30,
        requireNoViolation: true
      }
    }
  }
};

function getCriteriaForLevel(awardLevel, category) {
  const levelCriteria =
    officialCriteriaByLevel[awardLevel] ||
    officialCriteriaByLevel[AWARD_LEVELS.TRUONG];

  return levelCriteria[category] || null;
}

function getCommonCriteriaForLevel(awardLevel) {
  const levelCriteria =
    officialCriteriaByLevel[awardLevel] ||
    officialCriteriaByLevel[AWARD_LEVELS.TRUONG];

  return levelCriteria.common || null;
}

function getCollectiveCriteriaForLevel(awardLevel) {
  const levelCriteria =
    officialCriteriaByLevel[awardLevel] ||
    officialCriteriaByLevel[AWARD_LEVELS.TRUONG];

  return levelCriteria.collective || null;
}

function getCategoryLabel(category) {
  return categoryLabels[category] || category;
}

function getB1Equivalents() {
  return B1_EQUIVALENTS;
}

function getDirectHocTapTypes() {
  return DIRECT_HOC_TAP_TYPES;
}

module.exports = {
  categoryLabels,
  B1_EQUIVALENTS,
  DIRECT_HOC_TAP_TYPES,
  officialCriteriaByLevel,
  getCriteriaForLevel,
  getCommonCriteriaForLevel,
  getCollectiveCriteriaForLevel,
  getCategoryLabel,
  getB1Equivalents,
  getDirectHocTapTypes
};