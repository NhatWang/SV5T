const express = require("express");
const Student = require("../Models/Student");
const Activity = require("../Models/Activity");
const Evidence = require("../Models/Evidence");
const { callAzureClaude } = require("../Utils/azureAI");
const { requireStudentAuth } = require("../Middlewares/authMiddleware");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  buildEvidenceKey,
  uploadLocalFileToR2
} = require("../Utils/r2Client");

const { normalizeAwardLevel } = require("../Utils/sv5tLevels");

const {
  evaluateDaoDucSelfDeclare,
  evaluateHocTapMandatorySelfDeclare,
  evaluateNgoaiNguCourseScore
} = require("../Utils/selfDeclareEvaluator");

const {
  getCriteriaForLevel
} = require("../Utils/sv5tCriteria");

const {
  CENTRAL_CATEGORIES,
  CENTRAL_CATEGORY_LABELS,
  CENTRAL_MANDATORY_CRITERIA,
  CENTRAL_ADDITIONAL_CRITERIA,
  getCentralCriteriaForCategory
} = require("../Utils/centralCriteria");

const {
  isValidKyNangEvidenceForLevel,
  isValidHoiNhapEvidenceForLevel
} = require("../Utils/activityEligibility");

const router = express.Router();

const CURRENT_AWARD_LEVEL = "truong";

const CENTRAL_UPLOAD_DIR = "uploads/evidence-temp/";

if (!fs.existsSync(CENTRAL_UPLOAD_DIR)) {
  fs.mkdirSync(CENTRAL_UPLOAD_DIR, {
    recursive: true
  });
}

const centralStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, CENTRAL_UPLOAD_DIR);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  }
});

const centralUpload = multer({
  storage: centralStorage,
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg"
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file PDF, DOC, DOCX, PNG, JPG hoặc JPEG"));
    }
  }
});

function centralUploadMiddleware(req, res, next) {
  const handler = centralUpload.single("file");

  handler(req, res, function (err) {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File vượt quá 2 MB. Vui lòng chọn file nhỏ hơn."
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || "File upload không hợp lệ"
      });
    }

    next();
  });
}

const categories = [
  "daoDucTot",
  "hocTapTot",
  "theLucTot",
  "tinhNguyenTot",
  "hoiNhapTot"
];

const categoryLabels = {
  daoDucTot: "Đạo đức tốt",
  hocTapTot: "Học tập tốt",
  theLucTot: "Thể lực tốt",
  tinhNguyenTot: "Tình nguyện tốt",
  hoiNhapTot: "Hội nhập tốt"
};

const DIRECT_HOC_TAP_TYPES = [
  "nghienCuu",
  "sangTao",
  "troGiang",
  "baiBao",
  "doiTuyen",
  "khac_direct"
];

const defaultSuggestions = {
  daoDucTot: [
    "Kiểm tra điểm rèn luyện và đánh giá Đoàn viên/Hội viên cuối năm.",
    "Nếu đã đạt điều kiện, hãy hoàn tất form tự khai trong tab Đạo đức tốt."
  ],

  hocTapTot: [
    "Kiểm tra GPA cả năm, tình trạng nợ môn và xác nhận không gian lận trong học tập.",
    "Nếu đã đạt điều kiện bắt buộc, hãy upload thêm minh chứng học thuật để hoàn thành tiêu chí Học tập tốt."
  ],

  theLucTot: [
    "Bạn có thể nộp giấy chứng nhận Thanh niên khỏe, giải thể thao hoặc xác nhận tham gia câu lạc bộ thể thao.",
    "Nếu có minh chứng luyện tập thể thao tối thiểu 3 tháng, hãy upload file ở tab Thể lực tốt."
  ],

  tinhNguyenTot: [
    "Bạn có thể nộp giấy chứng nhận tình nguyện, xác nhận số ngày tình nguyện hoặc giấy chứng nhận hiến máu.",
    "Nếu đã tham gia chiến dịch Mùa hè xanh, Xuân tình nguyện hoặc Tiếp sức mùa thi, hãy upload minh chứng."
  ],

  hoiNhapTot: [
    "Bạn cần kiểm tra đủ 3 phần: ngoại ngữ, kỹ năng và hoạt động hội nhập.",
    "Với cấp Thành phố, phần ngoại ngữ cần có điều kiện ngoại ngữ cơ bản và thêm 01 minh chứng như giao lưu quốc tế, hội nghị/hội thảo quốc tế hoặc giải học thuật bằng ngoại ngữ từ cấp Trường trở lên."
  ]
};

const centralDefaultSuggestions = {
  daoDucTot:
    "Kiểm tra điểm rèn luyện từ 95/100 trở lên và xác nhận không vi phạm pháp luật, quy chế, nội quy. Nếu dữ liệu cấp dưới chưa đủ, hãy nộp minh chứng bổ sung để admin duyệt thủ công.",

  hocTapTot:
    "Kiểm tra GPA theo chuẩn cấp Trung ương và bổ sung minh chứng học thuật nếu cần. Các minh chứng như nghiên cứu khoa học, bài báo, sản phẩm sáng tạo hoặc giải học thuật có thể dùng cho tiêu chí đạt thêm.",

  theLucTot:
    "Kiểm tra hoạt động thể thao hoặc giải thể thao phù hợp. Nếu dữ liệu cấp dưới chưa đủ, hãy nộp minh chứng bổ sung để admin duyệt thủ công.",

  tinhNguyenTot:
    "Kiểm tra tổng số ngày tình nguyện và các khen thưởng/dự án tình nguyện. Nếu có khen thưởng hoặc dự án tình nguyện phù hợp, bạn có thể nộp làm tiêu chí đạt thêm.",

  hoiNhapTot:
    "Kiểm tra điều kiện ngoại ngữ và hoạt động giao lưu quốc tế. Nếu có minh chứng như CLB ngoại ngữ, giải hội nhập/học thuật bằng ngoại ngữ hoặc chứng chỉ ngoại ngữ phù hợp, bạn có thể nộp làm tiêu chí đạt thêm."
};

async function getAISuggestions(
  student,
  missingCategories,
  completedCategories,
  awardLevel = CURRENT_AWARD_LEVEL
) {
  try {
    if (missingCategories.length === 0) {
      return null;
    }

    const awardLevelLabelMap = {
      truong: "Cấp Trường",
      dhqg: "Cấp ĐHQG-HCM",
      thanh: "Cấp Thành phố Hồ Chí Minh",
      trung_uong: "Cấp Trung ương"
    };

    const awardLevelLabel = awardLevelLabelMap[awardLevel] || "Cấp Trường";
    const isCentralLevel = awardLevel === "trung_uong";

    const completedLabels = completedCategories.map((category) => {
      return categoryLabels[category];
    });

    const missingDetails = missingCategories
      .map((category) => {
        if (isCentralLevel) {
          const centralCriteria = getCentralCriteriaForCategory(category);

          return `
Tiêu chí: ${CENTRAL_CATEGORY_LABELS[category] || categoryLabels[category] || category}

Tiêu chuẩn bắt buộc cấp Trung ương:
${(centralCriteria?.mandatory?.conditions || centralCriteria?.conditions || [])
  .map((item) => {
    return `- ${item.text || item}`;
  })
  .join("\n")}

Lưu ý cấp Trung ương:
- Dữ liệu từ cấp Trường, cấp ĐHQG-HCM và cấp Thành phố có thể được dùng làm dữ liệu tham chiếu.
- Nếu dữ liệu tham chiếu chưa đủ, sinh viên có thể nộp minh chứng bổ sung.
- Minh chứng cấp Trung ương không chạy AI OCR. Admin sẽ kiểm tra và duyệt thủ công.
- Ngoài 5 tiêu chuẩn bắt buộc, sinh viên cần đạt ít nhất 02 tiêu chí đạt thêm trên toàn bộ hồ sơ.
`;
        }

        const criteria = getCriteriaForLevel(awardLevel, category);

        return `
Tiêu chí: ${categoryLabels[category]}
Điều kiện cần đạt:
${(criteria.batBuoc || criteria.mandatory || [])
  .map((item) => `- ${item}`)
  .join("\n")}

Minh chứng gợi ý:
${(criteria.minhChung || [])
  .map((item) => `- ${item}`)
  .join("\n")}
`;
      })
      .join("\n");

    const prompt = `
Bạn là trợ lý tư vấn chương trình Sinh viên 5 tốt ${awardLevelLabel} cho sinh viên đại học. Dựa trên thông tin về sinh viên và các tiêu chí đã hoàn thành, hãy đề xuất những bước cụ thể, thực tế mà sinh viên có thể làm để hoàn thành các tiêu chí còn thiếu và đạt được ${awardLevelLabel}.

Thông tin sinh viên:
- Họ tên: ${student.fullName}
- Lớp: ${student.className || "Chưa cập nhật"}
- Cấp xét hiện tại: ${awardLevelLabel}
- Tiêu chí đã đạt: ${
      completedLabels.length > 0
        ? completedLabels.join(", ")
        : "Chưa có tiêu chí nào"
    }

Các tiêu chí còn thiếu và quy định liên quan:
${missingDetails}

Hãy tạo đề xuất ngắn gọn, thực tế, dễ làm cho từng tiêu chí còn thiếu.

Yêu cầu:
- Viết bằng tiếng Việt.
- Xưng hô là "bạn".
- Không dùng từ "em".
- Đề xuất ngắn gọn, rõ ràng, dễ hiểu.
- Tập trung vào các tiêu chí sinh viên chưa hoàn thành.
- Chỉ tư vấn theo tiêu chuẩn của ${awardLevelLabel}.
- Không dùng nhầm điều kiện cấp Trường nếu đang xét cấp ĐHQG-HCM, cấp Thành phố hoặc cấp Trung ương.
- Nếu là cấp Thành phố, cần lưu ý các điều kiện có thể chặt hơn, đặc biệt ở Tình nguyện tốt và Hội nhập tốt.
- Nếu là cấp Thành phố và thiếu Hội nhập tốt, cần hiểu rằng Hội nhập tốt gồm 3 phần: Ngoại ngữ, Kỹ năng và Hoạt động hội nhập. Riêng phần Ngoại ngữ cấp Thành phố cần có điều kiện ngoại ngữ cơ bản và thêm 01 điều kiện bổ sung như giao lưu quốc tế hoặc giải hội nhập/học thuật bằng ngoại ngữ từ cấp Trường trở lên.
- Mỗi đề xuất 1-2 câu, nêu rõ sinh viên nên bổ sung gì và minh chứng nào phù hợp.
${
  isCentralLevel
    ? `
- Vì đang xét cấp Trung ương, hãy tư vấn theo cấu trúc: 5 tiêu chuẩn bắt buộc và 02 tiêu chí đạt thêm.
- Không nói rằng AI sẽ tự xác minh minh chứng cấp Trung ương. Minh chứng cấp Trung ương sẽ được admin kiểm tra và duyệt thủ công.
- Nếu dữ liệu từ cấp Trường, cấp ĐHQG-HCM hoặc cấp Thành phố đã đủ, hãy khuyên sinh viên kiểm tra lại dữ liệu tham chiếu trước khi nộp bổ sung.
- Nếu thiếu tiêu chí đạt thêm, hãy gợi ý sinh viên chọn đúng nhóm tiêu chí đạt thêm như Đạo đức, Học tập, Thể lực, Tình nguyện hoặc Hội nhập rồi nộp minh chứng tương ứng.
`
    : ""
}

Chỉ trả về JSON đúng format sau, không thêm markdown, không thêm giải thích ngoài JSON:
[
  {
    "category": "daoDucTot",
    "message": "nội dung đề xuất"
  }
]

Chỉ trả về các category còn thiếu sau:
${missingCategories.join(", ")}
`;

    const text = await callAzureClaude({
      system: "Bạn là trợ lý tư vấn chương trình Sinh viên 5 tốt. Chỉ trả về JSON đúng format, không thêm markdown.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1024,
      temperature: 0.7
    });

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return parsed.filter((item) => {
      return missingCategories.includes(item.category);
    });
  } catch (error) {
    console.error("getAISuggestions error:", error.message);
    return null;
  }
}

// GET /api/student-dashboard/me/dashboard
router.get("/me/dashboard", requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.studentId;

    const student = await Student.findOne({
      studentId
    }).select("-password");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên"
      });
    }

    const activities = await Activity.find({
      "participants.studentId": studentId,
      $or: [
        {
          eligibleAwardLevels: CURRENT_AWARD_LEVEL
        },
        {
          eligibleAwardLevels: {
            $exists: false
          },
          awardLevel: CURRENT_AWARD_LEVEL
        }
      ]
    }).sort({
      date: -1
    });

    const evidences = await Evidence.find({
      studentId,
      awardLevel: CURRENT_AWARD_LEVEL
    }).sort({
      createdAt: -1
    });

    const rawSelfDeclarations = student.selfDeclarations;

    let selfDeclarations = [];

if (Array.isArray(rawSelfDeclarations)) {
  selfDeclarations = rawSelfDeclarations.filter((item) => {
    return item && item.awardLevel === CURRENT_AWARD_LEVEL;
  });
} else if (
  rawSelfDeclarations &&
  typeof rawSelfDeclarations === "object"
) {
  selfDeclarations = Object.values(rawSelfDeclarations).filter((item) => {
    return item && item.awardLevel === CURRENT_AWARD_LEVEL;
  });
}

const schoolNgoaiNguCourseScoreDeclaration = selfDeclarations.find((item) => {
  return (
    item &&
    item.awardLevel === CURRENT_AWARD_LEVEL &&
    item.category === "hoiNhapTot" &&
    item.subCriteria === "ngoaiNgu" &&
    item.type === "foreign_language_course_score"
  );
});

const ngoaiNguCourseScoreSchoolResult = schoolNgoaiNguCourseScoreDeclaration
  ? evaluateNgoaiNguCourseScore(
      CURRENT_AWARD_LEVEL,
      schoolNgoaiNguCourseScoreDeclaration.data
    )
  : {
      isCompleted: false,
      scorePassed: false,
      reason: "Chưa có dữ liệu điểm học phần ngoại ngữ đã khai ở cấp Trường."
    };

    const progress = {};
    let completedCount = 0;
    const missingCategories = [];
    const completedCategories = [];

    categories.forEach((category) => {
      const relatedActivities = activities.filter((activity) => {
        return activity.category === category;
      });

      const relatedEvidences = evidences.filter((evidence) => {
        return evidence.category === category;
      });

      const hasActivity = relatedActivities.length > 0;

      const hasApprovedEvidence = relatedEvidences.some((evidence) => {
        return ["ai_valid", "approved_by_admin"].includes(evidence.status);
      });

      const savedProgress = student.sv5tProgress?.[category];

      let isCompleted = false;

      if (
        category === "hocTapTot" ||
        category === "tinhNguyenTot" ||
        category === "hoiNhapTot"
      ) {
        isCompleted = savedProgress?.isCompleted === true;
      } else {
        isCompleted =
          hasActivity ||
          hasApprovedEvidence ||
          savedProgress?.isCompleted === true;
      }

      let completedBy = "none";

      if (savedProgress?.isCompleted && savedProgress?.completedBy) {
        completedBy = savedProgress.completedBy;
      } else if (
        category !== "hocTapTot" &&
        category !== "tinhNguyenTot" &&
        category !== "hoiNhapTot" &&
        hasActivity
      ) {
        completedBy = "activity";
      } else if (
        category !== "hocTapTot" &&
        category !== "tinhNguyenTot" &&
        category !== "hoiNhapTot" &&
        hasApprovedEvidence
      ) {
        completedBy = "evidence";
      }

      if (isCompleted) {
        completedCount += 1;
        completedCategories.push(category);
      } else {
        missingCategories.push(category);
      }

      progress[category] = {
        isCompleted,
        completedBy,
        completedAt: savedProgress?.completedAt || null,

        volunteerDays: savedProgress?.volunteerDays || 0,
        hasVolunteerAward: savedProgress?.hasVolunteerAward || false,

        mandatoryPassed: savedProgress?.mandatoryPassed || false,
        mandatoryCompletedAt: savedProgress?.mandatoryCompletedAt || null,
        extraPassed: savedProgress?.extraPassed || false,
        extraCompletedAt: savedProgress?.extraCompletedAt || null,
        academicActivityCount: savedProgress?.academicActivityCount || 0,
        academicDirectPassed: savedProgress?.academicDirectPassed || false,

        subProgress: savedProgress?.subProgress || {
          ngoaiNgu: false,
          kyNang: false,
          hoiNhap: false
        },
        ngoaiNguCourseScoreDeclaration:
          category === "hoiNhapTot"
            ? schoolNgoaiNguCourseScoreDeclaration || null
            : null,

        ngoaiNguCourseScoreResult:
          category === "hoiNhapTot"
            ? ngoaiNguCourseScoreSchoolResult
            : null,

        activities: relatedActivities,
        evidences: relatedEvidences,
        criteria: getCriteriaForLevel(CURRENT_AWARD_LEVEL, category)
      };
    });

    const progressPercent = Math.round((completedCount / 5) * 100);

    let aiSuggestions = await getAISuggestions(
      student,
      missingCategories,
      completedCategories,
      CURRENT_AWARD_LEVEL
    );

    if (
      !aiSuggestions ||
      !Array.isArray(aiSuggestions) ||
      aiSuggestions.length === 0
    ) {
      aiSuggestions = missingCategories.map((category) => {
        return {
          category,
          message: defaultSuggestions[category].join(" ")
        };
      });
    }
    
    const officialCriteriaForCurrentLevel = {};

    categories.forEach((category) => {
      officialCriteriaForCurrentLevel[category] = getCriteriaForLevel(
        CURRENT_AWARD_LEVEL,
        category
      );
    });

    res.json({
  success: true,
  awardLevel: CURRENT_AWARD_LEVEL,
  student,
  progress,
  completedCount,
  progressPercent,
  aiSuggestions,
  activities,
  evidences,
  selfDeclarations,
  schoolSelfDeclarations: {
    ngoaiNguCourseScore: schoolNgoaiNguCourseScoreDeclaration || null
  },
  derivedSelfDeclarationResults: {
    ngoaiNguCourseScore: ngoaiNguCourseScoreSchoolResult
  },
  officialCriteria: officialCriteriaForCurrentLevel
});
  } catch (error) {
    console.error("Student dashboard error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy dữ liệu dashboard"
    });
  }
});

// GET /api/student-dashboard/me/higher-level?level=dhqg|thanh
router.get("/me/higher-level", requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.studentId;
    const awardLevel = normalizeAwardLevel(req.query.level);

    if (!["dhqg", "thanh"].includes(awardLevel)) {
      return res.status(400).json({
        success: false,
        message: "Cấp xét không hợp lệ"
      });
    }

    const student = await Student.findOne({
      studentId
    }).select("-password");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên"
      });
    }

    const schoolLevelCompleted =
      Number(student.totalCompletedCriteria || 0) >= 5 ||
      Number(student.progressPercent || 0) >= 100 ||
      student.sv5tStatus === "completed" ||
      categories.every((category) => {
        return student.sv5tProgress?.[category]?.isCompleted === true;
      });

    const rawSelfDeclarations = student.selfDeclarations;

        let selfDeclarations = [];

        if (Array.isArray(rawSelfDeclarations)) {
          selfDeclarations = rawSelfDeclarations;
        } else if (
          rawSelfDeclarations &&
          typeof rawSelfDeclarations === "object"
        ) {
          selfDeclarations = Object.values(rawSelfDeclarations);
        }

        const schoolDaoDucDeclaration = selfDeclarations.find((item) => {
          return item && item.awardLevel === "truong" && item.category === "daoDucTot";
        });

        const schoolHocTapDeclaration = selfDeclarations.find((item) => {
          return item && item.awardLevel === "truong" && item.category === "hocTapTot";
        });

        const schoolNgoaiNguCourseScoreDeclaration = selfDeclarations.find((item) => {
  return (
    item &&
    item.awardLevel === "truong" &&
    item.category === "hoiNhapTot" &&
    item.subCriteria === "ngoaiNgu" &&
    item.type === "foreign_language_course_score"
  );
});

const ngoaiNguCourseScoreHigherResult = schoolNgoaiNguCourseScoreDeclaration
  ? evaluateNgoaiNguCourseScore(
      awardLevel,
      schoolNgoaiNguCourseScoreDeclaration.data
    )
  : {
      isCompleted: false,
      scorePassed: false,
      reason:
        "Chưa có dữ liệu điểm học phần ngoại ngữ đã khai ở cấp Trường."
    };

    const daoDucHigherResult = schoolDaoDucDeclaration
      ? evaluateDaoDucSelfDeclare(awardLevel, schoolDaoDucDeclaration.data)
      : {
          isCompleted: false,
          requiredTrainingScore: null,
          reason:
            "Chưa có dữ liệu tự khai Đạo đức tốt ở cấp Trường để xét cấp cao hơn."
        };

    const hocTapMandatoryHigherResult = schoolHocTapDeclaration
      ? evaluateHocTapMandatorySelfDeclare(
          awardLevel,
          schoolHocTapDeclaration.data
        )
      : {
          isCompleted: false,
          gpaPassed: false,
          requiredText: "",
          reason:
            "Chưa có dữ liệu tự khai Học tập tốt ở cấp Trường để xét cấp cao hơn."
        };

    const activities = await Activity.find({
      "participants.studentId": studentId,
      $or: [
        {
          eligibleAwardLevels: awardLevel
        },
        {
          eligibleAwardLevels: {
            $exists: false
          },
          awardLevel
        }
      ]
    }).sort({
      date: -1
    });

    const reusableSchoolEvidenceCategories = [
      "hocTapTot",
      "theLucTot",
      "tinhNguyenTot",
      "hoiNhapTot"
    ];

    const evidences = await Evidence.find({
      studentId,
      $or: [
        {
          awardLevel
        },
        {
          awardLevel: "truong",
          category: {
            $in: reusableSchoolEvidenceCategories
          },
          status: "approved_by_admin"
        }
      ]
    }).sort({
      createdAt: -1
    });

    const progress = {};
    let completedCount = 0;
    const missingCategories = [];
    const completedCategories = [];

    categories.forEach((category) => {
      const relatedActivities = activities.filter((activity) => {
        return activity.category === category;
      });

      const relatedEvidences = evidences.filter((evidence) => {
        return evidence.category === category;
      });

      // Cấp ĐHQG / Cấp Thành:
      // AI chỉ đề xuất, admin phải duyệt thì minh chứng mới được tính.
      const validEvidences = relatedEvidences.filter((evidence) => {
        return evidence.status === "approved_by_admin";
      });

      const hasActivity = relatedActivities.length > 0;
      const hasApprovedEvidence = validEvidences.length > 0;

      let isCompleted = false;
      let completedBy = "none";

      let mandatoryPassed = false;
      let mandatoryCompletedAt = null;

      let extraPassed = false;
      let extraCompletedAt = null;
      let academicActivityCount = 0;
      let academicDirectPassed = false;

      let volunteerDays = 0;
      let hasVolunteerAward = false;

      let subProgress = {
        ngoaiNgu: false,
        kyNang: false,
        hoiNhap: false
      };
      let foreignLanguageProgress = {
        basePassed: false,
        extraPassed: false
      };

      if (category === "daoDucTot") {
        isCompleted = daoDucHigherResult.isCompleted === true;
        completedBy = isCompleted ? "system" : "none";
      }

      if (category === "hocTapTot") {
        mandatoryPassed = hocTapMandatoryHigherResult.isCompleted === true;
        mandatoryCompletedAt = mandatoryPassed ? new Date() : null;

        validEvidences.forEach((evidence) => {
          const type = evidence.aiResult?.academicEvidenceType || "";
          const count = Number(evidence.aiResult?.academicActivityCount || 0);

          if (type === "hocThuat_3_activities") {
            academicActivityCount += count > 0 ? count : 1;
          }

          if (DIRECT_HOC_TAP_TYPES.includes(type)) {
            academicDirectPassed = true;
          }
        });

        relatedActivities.forEach((activity) => {
          const participant = activity.participants.find((p) => {
            return p.studentId === studentId;
          });

          const type =
            participant?.academicEvidenceType ||
            activity.academicEvidenceType ||
            "hocThuat_3_activities";

          if (type === "hocThuat_3_activities") {
            academicActivityCount += 1;
          }

          if (DIRECT_HOC_TAP_TYPES.includes(type)) {
            academicDirectPassed = true;
          }
        });

        extraPassed = academicDirectPassed || validEvidences.length > 0 || relatedActivities.length > 0;
        extraCompletedAt = extraPassed ? new Date() : null;

        isCompleted = mandatoryPassed && extraPassed;

        if (isCompleted) {
          completedBy = "student_declare_and_evidence";
        }
      }

      if (category === "theLucTot") {
        isCompleted = hasActivity || hasApprovedEvidence;

        completedBy = hasActivity
          ? "activity"
          : hasApprovedEvidence
          ? "evidence"
          : "none";
      }

      if (category === "tinhNguyenTot") {
  validEvidences.forEach((evidence) => {
    volunteerDays += Number(evidence.aiResult?.volunteerDays || 0);

    const matchedType = String(
      evidence.aiResult?.matchedType || ""
    ).toLowerCase();

    if (
      evidence.aiResult?.hasVolunteerAward === true ||
      matchedType.includes("giấy khen") ||
      matchedType.includes("khen thưởng")
    ) {
      hasVolunteerAward = true;
    }
  });

  relatedActivities.forEach((activity) => {
  const participant = (activity.participants || []).find((p) => {
    return String(p.studentId) === String(studentId);
  });

  const days =
    Number(participant?.volunteerDays || 0) ||
    Number(activity.volunteerDays || 0);

  volunteerDays += days;

  const title = String(activity.title || "").toLowerCase();

  const activityIsVolunteerAward =
    participant?.isVolunteerAward === true ||
    activity.isVolunteerAward === true ||
    title.includes("khen thưởng") ||
    title.includes("giấy khen") ||
    title.includes("giay khen") ||
    title.includes("khen thuong");

  if (activityIsVolunteerAward) {
    hasVolunteerAward = true;
  }
});

  if (awardLevel === "thanh") {
    isCompleted = hasVolunteerAward && volunteerDays >= 5;
  } else {
    isCompleted = hasVolunteerAward || volunteerDays >= 5;
  }

  if (isCompleted) {
    completedBy =
      hasActivity && hasApprovedEvidence
        ? "activity_and_evidence"
        : hasActivity
        ? "activity"
        : "evidence";
  }
}

if (category === "hoiNhapTot") {
  let ngoaiNguBasePassed = false;
  let ngoaiNguExtraPassed = false;

  if (ngoaiNguCourseScoreHigherResult.isCompleted) {
    ngoaiNguBasePassed = true;
  }

  function isNgoaiNguExtraActivity(activity, participant) {
    const sub =
      participant?.subCriteria ||
      activity.subCriteria ||
      "";

    const hoiNhapEvidenceType =
      participant?.hoiNhapEvidenceType ||
      activity.hoiNhapEvidenceType ||
      "";

    const organizerLevel =
      activity.organizerLevel ||
      activity.awardLevel ||
      "";

    const title = String(activity.title || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const validOrganizerLevels = [
      "truong",
      "dhqg",
      "thanh",
      "quoc_gia",
      "quoc_te"
    ];

    const validExtraTypes = [
      "international_exchange",
      "official_international_program_member",
      "international_program_volunteer",
      "integration_competition_award_truong_or_above",
      "foreign_language_academic_competition_award_truong_or_above"
    ];

    const fallbackByTitle =
      title.includes("giao luu quoc te") ||
      title.includes("giao luu sinh vien quoc te") ||
      title.includes("hoi nghi quoc te") ||
      title.includes("hoi thao quoc te") ||
      title.includes("hop tac quoc te") ||
      title.includes("seminar") ||
      title.includes("international");

    return (
      sub === "hoiNhap" &&
      validOrganizerLevels.includes(organizerLevel) &&
      (
        validExtraTypes.includes(hoiNhapEvidenceType) ||
        fallbackByTitle
      )
    );
  }

  validEvidences.forEach((evidence) => {
    const sub = evidence.aiResult?.subCriteria || "";
    const foreignType = evidence.aiResult?.foreignLanguageEvidenceType || "";

    if (sub === "ngoaiNgu") {
      if (
        foreignType === "language_certificate" ||
        foreignType === "course_score" ||
        foreignType === ""
      ) {
        ngoaiNguBasePassed = true;
      }

      if (
        foreignType === "international_exchange" ||
        foreignType === "integration_competition_award" ||
        foreignType === "foreign_language_academic_competition_award"
      ) {
        ngoaiNguExtraPassed = true;
      }
    }

    if (sub === "kyNang") {
      const kyNangEvidenceType =
        evidence.aiResult?.kyNangEvidenceType || "";

      if (isValidKyNangEvidenceForLevel(awardLevel, kyNangEvidenceType)) {
        subProgress.kyNang = true;
      }
    }

    if (sub === "hoiNhap") {
      const hoiNhapEvidenceType =
        evidence.aiResult?.hoiNhapEvidenceType || "";

      if (isValidHoiNhapEvidenceForLevel(awardLevel, hoiNhapEvidenceType)) {
        subProgress.hoiNhap = true;
      }

      if (
        [
          "international_exchange",
          "official_international_program_member",
          "international_program_volunteer",
          "integration_competition_award_truong_or_above",
          "foreign_language_academic_competition_award_truong_or_above"
        ].includes(hoiNhapEvidenceType)
      ) {
        ngoaiNguExtraPassed = true;
      }
    }
  });

  relatedActivities.forEach((activity) => {
    const participant = (activity.participants || []).find((p) => {
      return String(p.studentId) === String(studentId);
    });

    const sub =
      participant?.subCriteria ||
      activity.subCriteria ||
      "";

    const foreignType =
      participant?.foreignLanguageEvidenceType ||
      activity.foreignLanguageEvidenceType ||
      "";

    if (sub === "ngoaiNgu") {
      if (
        awardLevel !== "thanh" ||
        foreignType === "language_certificate" ||
        foreignType === "course_score" ||
        foreignType === ""
      ) {
        ngoaiNguBasePassed = true;
      }

      if (
        foreignType === "international_exchange" ||
        foreignType === "integration_competition_award" ||
        foreignType === "foreign_language_academic_competition_award"
      ) {
        ngoaiNguExtraPassed = true;
      }
    }

    if (sub === "kyNang") {
      const kyNangEvidenceType =
        participant?.kyNangEvidenceType ||
        activity.kyNangEvidenceType ||
        "";

      if (isValidKyNangEvidenceForLevel(awardLevel, kyNangEvidenceType)) {
        subProgress.kyNang = true;
      }
    }

    if (sub === "hoiNhap") {
      const hoiNhapEvidenceType =
        participant?.hoiNhapEvidenceType ||
        activity.hoiNhapEvidenceType ||
        "";

      if (isValidHoiNhapEvidenceForLevel(awardLevel, hoiNhapEvidenceType)) {
        subProgress.hoiNhap = true;
      }

      if (isNgoaiNguExtraActivity(activity, participant)) {
        ngoaiNguExtraPassed = true;
      }
    }
  });

  if (awardLevel === "thanh") {
    subProgress.ngoaiNgu = ngoaiNguBasePassed && ngoaiNguExtraPassed;
  } else {
    subProgress.ngoaiNgu = ngoaiNguBasePassed || ngoaiNguExtraPassed;
  }

  foreignLanguageProgress = {
    basePassed: ngoaiNguBasePassed,
    extraPassed: ngoaiNguExtraPassed
  };

  isCompleted =
    subProgress.ngoaiNgu &&
    subProgress.kyNang &&
    subProgress.hoiNhap;

  if (isCompleted) {
    completedBy =
      hasActivity && hasApprovedEvidence
        ? "activity_and_evidence"
        : hasActivity
        ? "activity"
        : "evidence";
  }
}

      if (isCompleted) {
        completedCount += 1;
        completedCategories.push(category);
      } else {
        missingCategories.push(category);
      }

      progress[category] = {
        isCompleted,
        completedBy,
        completedAt: isCompleted ? new Date() : null,

        volunteerDays,
        hasVolunteerAward,

        mandatoryPassed,
        mandatoryCompletedAt,
        extraPassed,
        extraCompletedAt,
        academicActivityCount,
        academicDirectPassed,

        subProgress,
        foreignLanguageProgress,
        ngoaiNguCourseScoreDeclaration:
          category === "hoiNhapTot"
            ? schoolNgoaiNguCourseScoreDeclaration || null
            : null,

        ngoaiNguCourseScoreResult:
          category === "hoiNhapTot"
            ? ngoaiNguCourseScoreHigherResult
            : null,

        activities: relatedActivities,
        evidences: relatedEvidences,
        criteria: getCriteriaForLevel(awardLevel, category)
      };
    });

    const progressPercent = Math.round((completedCount / 5) * 100);
    student.higherLevelStatus = student.higherLevelStatus || {};

    const storedHigherLevelProgress = {};

categories.forEach((category) => {
  const item = progress[category] || {};

  storedHigherLevelProgress[category] = {
    isCompleted: item.isCompleted === true,
    completedBy: item.completedBy || "none",
    completedAt: item.completedAt || null,

    volunteerDays: item.volunteerDays || 0,
    hasVolunteerAward: item.hasVolunteerAward || false,

    mandatoryPassed: item.mandatoryPassed || false,
    mandatoryCompletedAt: item.mandatoryCompletedAt || null,

    extraPassed: item.extraPassed || false,
    extraCompletedAt: item.extraCompletedAt || null,

    academicActivityCount: item.academicActivityCount || 0,
    academicDirectPassed: item.academicDirectPassed || false,

    subProgress: item.subProgress || {
      ngoaiNgu: false,
      kyNang: false,
      hoiNhap: false
    },

    foreignLanguageProgress: item.foreignLanguageProgress || {
      basePassed: false,
      extraPassed: false
    }
  };
});

if (awardLevel === "dhqg") {
  student.dhqgProgress = storedHigherLevelProgress;
  student.markModified("dhqgProgress");
}

if (awardLevel === "thanh") {
  student.thanhProgress = storedHigherLevelProgress;
  student.markModified("thanhProgress");
}

student.higherLevelStatus[awardLevel] = {
  completedCount,
  progressPercent,
  isCompleted: completedCount === 5 || progressPercent >= 100,
  updatedAt: new Date()
};

student.markModified("higherLevelStatus");
await student.save();

    let aiSuggestions = await getAISuggestions(
  student,
  missingCategories,
  completedCategories,
  awardLevel
);

if (
  !aiSuggestions ||
  !Array.isArray(aiSuggestions) ||
  aiSuggestions.length === 0
) {
  aiSuggestions = missingCategories.map((category) => {
    return {
      category,
      message: `Bạn còn thiếu tiêu chí ${categoryLabels[category]} ở ${
        awardLevel === "dhqg"
          ? "cấp ĐHQG-HCM"
          : "cấp Thành phố Hồ Chí Minh"
      }. Vui lòng kiểm tra tiêu chuẩn của cấp xét hiện tại và bổ sung minh chứng phù hợp.`
    };
  });
}

let centralPrerequisites = null;

if (awardLevel === "thanh") {
  const thanhLevelCompleted =
    completedCount === 5 || Number(progressPercent || 0) >= 100;

  centralPrerequisites = {
    hasProvincialAward: {
      isApproved: thanhLevelCompleted,
      source: "system",
      note: thanhLevelCompleted
        ? "Tự động xác định vì sinh viên đã hoàn thành 5/5 tiêu chí cấp Thành phố."
        : "Sinh viên chưa hoàn thành đủ 5/5 tiêu chí cấp Thành phố."
    },

    canProceedToCentral: thanhLevelCompleted
  };
}

    res.json({
  success: true,
  awardLevel,
  student,
  schoolLevelCompleted,

  progress,
  completedCount,
  progressPercent,

  aiSuggestions,
  activities,
  evidences,

  centralPrerequisites,

  schoolSelfDeclarations: {
    daoDucTot: schoolDaoDucDeclaration || null,
    hocTapTot: schoolHocTapDeclaration || null,
    ngoaiNguCourseScore: schoolNgoaiNguCourseScoreDeclaration || null
  },

  derivedSelfDeclarationResults: {
    daoDucTot: daoDucHigherResult,
    hocTapTot: hocTapMandatoryHigherResult,
    ngoaiNguCourseScore: ngoaiNguCourseScoreHigherResult
  }
});
  } catch (error) {
    console.error("Higher level dashboard error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy dữ liệu xét cấp cao hơn"
    });
  }
});

router.post("/declare/ngoai-ngu", requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.studentId;

    // Điểm học phần ngoại ngữ chỉ được khai ở cấp Trường.
    // Cấp ĐHQG-HCM và cấp Thành phố sẽ lấy lại dữ liệu này để tự so sánh.
    const awardLevel = "truong";

    const scoreScale = String(req.body.scoreScale || "4");
    const scoreValue = Number(req.body.scoreValue || 0);

    if (!["4", "10"].includes(scoreScale)) {
      return res.status(400).json({
        success: false,
        message: "Hệ điểm không hợp lệ. Chỉ chấp nhận hệ 4.0 hoặc hệ 10."
      });
    }

    if (Number.isNaN(scoreValue) || scoreValue <= 0) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập điểm học phần ngoại ngữ hợp lệ."
      });
    }

    if (scoreScale === "4" && scoreValue > 4) {
      return res.status(400).json({
        success: false,
        message: "Điểm hệ 4.0 không được lớn hơn 4.0."
      });
    }

    if (scoreScale === "10" && scoreValue > 10) {
      return res.status(400).json({
        success: false,
        message: "Điểm hệ 10 không được lớn hơn 10."
      });
    }

    const student = await Student.findOne({ studentId });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên."
      });
    }

    const result = evaluateNgoaiNguCourseScore("truong", {
  scoreScale,
  scoreValue,
  confirmed: true
});

const declaration = {
  awardLevel: "truong",
  category: "hoiNhapTot",
  subCriteria: "ngoaiNgu",
  type: "foreign_language_course_score",
  data: {
    scoreScale,
    scoreValue,
    confirmed: true
  },
  isCompleted: result.isCompleted,
  reason: result.reason,
  evaluatedBy: "system",
  declaredAt: new Date()
};

    let selfDeclarations = [];

    if (Array.isArray(student.selfDeclarations)) {
      selfDeclarations = student.selfDeclarations;
    } else if (
      student.selfDeclarations &&
      typeof student.selfDeclarations === "object"
    ) {
      selfDeclarations = Object.values(student.selfDeclarations);
    }

    selfDeclarations = selfDeclarations.filter((item) => {
      return !(
        item &&
        item.awardLevel === "truong" &&
        item.category === "hoiNhapTot" &&
        item.subCriteria === "ngoaiNgu" &&
        item.type === "foreign_language_course_score"
      );
    });

    selfDeclarations.push(declaration);

    student.selfDeclarations = selfDeclarations;

    await student.save();

    return res.json({
      success: true,
      message: "Đã lưu điểm học phần ngoại ngữ ở cấp Trường.",
      declaration,
      result
    });
  } catch (error) {
    console.error("Declare ngoai ngu error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lưu điểm học phần ngoại ngữ."
    });
  }
});

// GET /api/student-dashboard/me/central-level
router.get("/me/central-level", requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.studentId;

    const student = await Student.findOne({
      studentId
    }).select("-password");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên"
      });
    }

    const thanhStatus = student.higherLevelStatus?.thanh || {};

    const rawSelfDeclarations = student.selfDeclarations;

let selfDeclarations = [];

if (Array.isArray(rawSelfDeclarations)) {
  selfDeclarations = rawSelfDeclarations;
} else if (
  rawSelfDeclarations &&
  typeof rawSelfDeclarations === "object"
) {
  selfDeclarations = Object.values(rawSelfDeclarations);
}

const schoolDaoDucDeclaration = selfDeclarations.find((item) => {
  return item && item.awardLevel === "truong" && item.category === "daoDucTot";
});

const schoolHocTapDeclaration = selfDeclarations.find((item) => {
  return item && item.awardLevel === "truong" && item.category === "hocTapTot";
});

const schoolNgoaiNguCourseScoreDeclaration = selfDeclarations.find((item) => {
  return (
    item &&
    item.awardLevel === "truong" &&
    item.category === "hoiNhapTot" &&
    item.subCriteria === "ngoaiNgu" &&
    item.type === "foreign_language_course_score"
  );
});

const daoDucCentralResult = schoolDaoDucDeclaration
  ? evaluateDaoDucSelfDeclare("trung_uong", schoolDaoDucDeclaration.data)
  : {
      isCompleted: false,
      reason:
        "Chưa có dữ liệu tự khai Đạo đức tốt ở cấp Trường để xét cấp Trung ương."
    };

const hocTapCentralResult = schoolHocTapDeclaration
  ? evaluateHocTapMandatorySelfDeclare(
      "trung_uong",
      schoolHocTapDeclaration.data
    )
  : {
      isCompleted: false,
      reason:
        "Chưa có dữ liệu tự khai Học tập tốt ở cấp Trường để xét cấp Trung ương."
    };

const ngoaiNguCourseScoreCentralResult = schoolNgoaiNguCourseScoreDeclaration
  ? evaluateNgoaiNguCourseScore(
      "trung_uong",
      schoolNgoaiNguCourseScoreDeclaration.data
    )
  : {
      isCompleted: false,
      reason:
        "Chưa có dữ liệu điểm học phần ngoại ngữ đã khai ở cấp Trường để xét cấp Trung ương."
    };

const previousActivities = await Activity.find({
  "participants.studentId": studentId,
  $or: [
    { awardLevel: "truong" },
    { awardLevel: "dhqg" },
    { awardLevel: "thanh" },

    { eligibleAwardLevels: "truong" },
    { eligibleAwardLevels: "dhqg" },
    { eligibleAwardLevels: "thanh" }
  ]
}).sort({
  date: -1
});

const previousEvidences = await Evidence.find({
  studentId,
  awardLevel: {
    $in: ["truong", "dhqg", "thanh"]
  },
  status: {
    $in: ["approved_by_admin", "ai_valid"]
  }
}).sort({
  createdAt: -1
});

const canAccessCentral =
  thanhStatus.isCompleted === true ||
  Number(thanhStatus.completedCount || 0) >= 5 ||
  Number(thanhStatus.progressPercent || 0) >= 100;

    if (!canAccessCentral) {
      return res.status(403).json({
        success: false,
        message:
          "Bạn cần hoàn thành 5/5 tiêu chí cấp Thành phố trước khi tiếp tục chuẩn bị hồ sơ cấp Trung ương."
      });
    }

    const mandatory = CENTRAL_CATEGORIES.map((category) => {
  const criteria = CENTRAL_MANDATORY_CRITERIA[category];

  return {
    key: category,
    label: criteria?.label || CENTRAL_CATEGORY_LABELS[category] || category,
    description: criteria?.conditions
      ? criteria.conditions.map((condition) => condition.text).join(" ")
      : "",
    conditions: criteria?.conditions || [],
    requiredAll: criteria?.requiredAll !== false
  };
});

    const additional = CENTRAL_ADDITIONAL_CRITERIA.map((item) => {
  return {
    key: item.key,
    category: item.category,
    label: item.label,
    description: item.text,
    isApproved: false,
    approvedBy: "",
    approvedAt: null,
    note: ""
  };
});

    const centralEvidences = await Evidence.find({
  studentId,
  awardLevel: "trung_uong"
}).sort({
  createdAt: -1
});

const approvedAdditionalKeys = new Set();

centralEvidences.forEach((evidence) => {
  if (
    evidence.evidenceType === "central_additional" &&
    evidence.status === "approved_by_admin"
  ) {
    const key =
      evidence.additionalCriteriaKey ||
      evidence.centralAdditionalKey ||
      evidence.criteriaKey ||
      "";

    if (key) {
      approvedAdditionalKeys.add(key);
    }
  }
});

const additionalCriteriaCount = approvedAdditionalKeys.size;
const additionalProgressPercent = Math.round(
  (Math.min(additionalCriteriaCount, 2) / 2) * 100
);

function hasApprovedCentralEvidence(category) {
  return centralEvidences.some((evidence) => {
    return (
      evidence.category === category &&
      evidence.awardLevel === "trung_uong" &&
      evidence.status === "approved_by_admin"
    );
  });
}

function getRelatedPreviousActivities(category) {
  return previousActivities.filter((activity) => {
    return activity.category === category;
  });
}

function getRelatedPreviousEvidences(category) {
  return previousEvidences.filter((evidence) => {
    return evidence.category === category;
  });
}

function hasReferenceActivity(category) {
  return getRelatedPreviousActivities(category).length > 0;
}

function hasReferenceEvidence(category) {
  return getRelatedPreviousEvidences(category).length > 0;
}

function isReferencePassed(category) {
  if (category === "daoDucTot") {
    return daoDucCentralResult.isCompleted === true;
  }

  if (category === "hocTapTot") {
    return hocTapCentralResult.isCompleted === true;
  }

  if (category === "theLucTot") {
    return hasReferenceActivity(category) || hasReferenceEvidence(category);
  }

  if (category === "tinhNguyenTot") {
    return hasReferenceActivity(category) || hasReferenceEvidence(category);
  }

  if (category === "hoiNhapTot") {
    return (
      ngoaiNguCourseScoreCentralResult.isCompleted === true ||
      hasReferenceActivity(category) ||
      hasReferenceEvidence(category)
    );
  }

  return false;
}

const centralProgress = {};
let completedCount = 0;

CENTRAL_CATEGORIES.forEach((category) => {
  const mandatoryItem = mandatory.find((item) => {
    return item.key === category;
  });

  const referencePassed = isReferencePassed(category);
  const adminApproved = hasApprovedCentralEvidence(category);

  const isCompleted = referencePassed || adminApproved;

  let completedBy = "none";
  let status = "missing_reference";

  if (referencePassed) {
    completedBy = "reference";
    status = "completed_by_reference";
  }

  if (adminApproved) {
    completedBy = "admin_approved_evidence";
    status = "completed_by_admin";
  }

  if (referencePassed && adminApproved) {
    completedBy = "reference_and_admin";
    status = "completed";
  }

  if (isCompleted) {
    completedCount += 1;
  }

  centralProgress[category] = {
    isCompleted,
    completedBy,
    status,

    referencePassed,
    adminApproved,

    label: mandatoryItem?.label || categoryLabels[category] || category,
    description: mandatoryItem?.description || "",

    previousActivities: getRelatedPreviousActivities(category),
    previousEvidences: getRelatedPreviousEvidences(category),

    centralEvidences: centralEvidences.filter((evidence) => {
      return evidence.category === category;
    })
  };
});

const progressPercent = Math.round(
  (completedCount / CENTRAL_CATEGORIES.length) * 100
);

const storedCentralProgress = {};

CENTRAL_CATEGORIES.forEach((category) => {
  const item = centralProgress[category] || {};

  storedCentralProgress[category] = {
    isCompleted: item.isCompleted === true,
    completedBy: item.completedBy || "none",
    completedAt: item.isCompleted ? new Date() : null,

    status: item.status || "missing_reference",
    referencePassed: item.referencePassed === true,
    adminApproved: item.adminApproved === true,

    label: item.label || CENTRAL_CATEGORY_LABELS[category] || category,
    description: item.description || ""
  };
});

student.centralProgress = storedCentralProgress;

student.centralSummary = {
  mandatoryCompletedCount: completedCount,
  mandatoryProgressPercent: progressPercent,
  additionalCriteriaCount,
  additionalProgressPercent,
  isCentralQualified:
    completedCount === CENTRAL_CATEGORIES.length &&
    additionalCriteriaCount >= 2,
  updatedAt: new Date()
};

student.markModified("centralProgress");
student.markModified("centralSummary");

await student.save();

const missingCategories = CENTRAL_CATEGORIES.filter((category) => {
  return centralProgress[category]?.isCompleted !== true;
});

const completedCategories = CENTRAL_CATEGORIES.filter((category) => {
  return centralProgress[category]?.isCompleted === true;
});

let aiSuggestions = await getAISuggestions(
  student,
  missingCategories,
  completedCategories,
  "trung_uong"
);

if (
  !aiSuggestions ||
  !Array.isArray(aiSuggestions) ||
  aiSuggestions.length === 0
) {
  aiSuggestions = missingCategories.map((category) => {
    return {
      category,
      message: `Bạn còn thiếu tiêu chí ${CENTRAL_CATEGORY_LABELS[category] || category} ở cấp Trung ương. Hãy kiểm tra dữ liệu tham chiếu từ cấp Trường, cấp ĐHQG-HCM, cấp Thành phố hoặc nộp minh chứng bổ sung để admin duyệt thủ công.`
    };
  });
}

    return res.json({
  success: true,
  student,

  summary: {
  canAccessCentral,
  mandatoryCompletedCount: completedCount,
  additionalCriteriaCount,
  additionalProgressPercent,
  isCentralQualified:
    completedCount === CENTRAL_CATEGORIES.length &&
    additionalCriteriaCount >= 2
},

  progress: centralProgress,
  completedCount,
  progressPercent,

  additionalCriteriaCount,
additionalProgressPercent,

  mandatory,
  additional,

  officialCriteria: CENTRAL_CATEGORIES.reduce((result, category) => {
    result[category] = getCentralCriteriaForCategory(category);
    return result;
  }, {}),

  centralEvidences,
  evidences: centralEvidences,

  sourceData: {
    schoolSelfDeclarations: {
      daoDucTot: schoolDaoDucDeclaration || null,
      hocTapTot: schoolHocTapDeclaration || null,
      ngoaiNguCourseScore: schoolNgoaiNguCourseScoreDeclaration || null
    },
    derivedSelfDeclarationResults: {
      daoDucTot: daoDucCentralResult,
      hocTapTot: hocTapCentralResult,
      ngoaiNguCourseScore: ngoaiNguCourseScoreCentralResult
    },
    previousActivities,
    previousEvidences
  }
});
  } catch (error) {
    console.error("Central level dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy dữ liệu cấp Trung ương"
    });
  }
});

router.post(
  "/central-evidence",
  requireStudentAuth,
  centralUploadMiddleware,
  async (req, res) => {
    try {
      const studentId = req.student.studentId;

      const {
  title,
  category,
  evidenceType,
  awardLevel,
  additionalCriteriaKey
} = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn file minh chứng."
        });
      }

      if (!title || !category) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập đầy đủ tên minh chứng và tiêu chí."
        });
      }

      if (awardLevel !== "trung_uong") {
        return res.status(400).json({
          success: false,
          message: "awardLevel không hợp lệ cho minh chứng cấp Trung ương."
        });
      }

      const allowedCategories = [
        "daoDucTot",
        "hocTapTot",
        "theLucTot",
        "tinhNguyenTot",
        "hoiNhapTot"
      ];

      if (!allowedCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Tiêu chí không hợp lệ."
        });
      }

      if (evidenceType === "central_additional" && !additionalCriteriaKey) {
  return res.status(400).json({
    success: false,
    message: "Vui lòng chọn tiêu chí đạt thêm cần nộp minh chứng."
  });
}

      const student = await Student.findOne({ studentId });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy sinh viên."
        });
      }


      const thanhStatus = student.higherLevelStatus?.thanh || {};

      const canAccessCentral =
        thanhStatus.isCompleted === true ||
        Number(thanhStatus.completedCount || 0) >= 5 ||
        Number(thanhStatus.progressPercent || 0) >= 100;

      if (!canAccessCentral) {
        return res.status(403).json({
          success: false,
          message:
            "Bạn cần hoàn thành 5/5 tiêu chí cấp Thành phố trước khi nộp minh chứng cấp Trung ương."
        });
      }

      const rawSelfDeclarations = student.selfDeclarations;

let selfDeclarations = [];

if (Array.isArray(rawSelfDeclarations)) {
  selfDeclarations = rawSelfDeclarations;
} else if (
  rawSelfDeclarations &&
  typeof rawSelfDeclarations === "object"
) {
  selfDeclarations = Object.values(rawSelfDeclarations);
}

const schoolDaoDucDeclaration = selfDeclarations.find((item) => {
  return item && item.awardLevel === "truong" && item.category === "daoDucTot";
});

const schoolHocTapDeclaration = selfDeclarations.find((item) => {
  return item && item.awardLevel === "truong" && item.category === "hocTapTot";
});

const schoolNgoaiNguCourseScoreDeclaration = selfDeclarations.find((item) => {
  return (
    item &&
    item.awardLevel === "truong" &&
    item.category === "hoiNhapTot" &&
    item.subCriteria === "ngoaiNgu" &&
    item.type === "foreign_language_course_score"
  );
});

      let fileKey = "";
      let fileUrl = "";
      let storageStatus = "local_temp";

      try {
        fileKey = buildEvidenceKey(studentId, req.file.originalname);

        const uploadedFile = await uploadLocalFileToR2({
          localPath: req.file.path,
          key: fileKey,
          contentType: req.file.mimetype
        });

        fileKey = uploadedFile.key;
        fileUrl = uploadedFile.url;
        storageStatus = "r2_archived";

        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (uploadError) {
        console.error("Central evidence R2 upload error:", uploadError.message);
      }

      const evidence = await Evidence.create({
  studentId,
  category,
  awardLevel: "trung_uong",
  evidenceType:
    evidenceType === "central_additional"
      ? "central_additional"
      : "central_mandatory",

  additionalCriteriaKey:
    evidenceType === "central_additional" ? additionalCriteriaKey : "",

  fileName: req.file.originalname,
  filePath: storageStatus === "r2_archived" ? "" : req.file.path,
  fileKey,
  fileUrl,
  fileSize: req.file.size,
  fileType: req.file.mimetype,
  storageStatus,

  status: "manual_review",

  aiResult: {
    isValid: null,
    confidence: 0,
    matchedType: "",
    extractedText: "",
    matchedEvidence: [],
    missingInfo: [],
    reason:
      "Minh chứng cấp Trung ương không chạy AI OCR. Admin sẽ kiểm tra và duyệt thủ công."
  },

  adminReview: {
    reviewedBy: "",
    reviewedAt: null,
    note: ""
  }
});

      await evidence.save();

      return res.json({
        success: true,
        message:
          "Nộp minh chứng cấp Trung ương thành công. Minh chứng sẽ chờ admin duyệt thủ công.",
        evidence
      });
    } catch (error) {
      console.error("Upload central evidence error:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi nộp minh chứng cấp Trung ương."
      });
    }
  }
);

module.exports = router;