const express = require("express");
const Student = require("../Models/Student");
const Activity = require("../Models/Activity");
const Evidence = require("../Models/Evidence");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const { requireStudentAuth } = require("../Middlewares/authMiddleware");

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
  isValidKyNangEvidenceForLevel,
  isValidHoiNhapEvidenceForLevel
} = require("../Utils/activityEligibility");

const router = express.Router();

const CURRENT_AWARD_LEVEL = "truong";

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
    "Bạn có thể nộp chứng chỉ ngoại ngữ, chứng nhận kỹ năng hoặc giấy chứng nhận hoạt động hội nhập.",
    "Nếu có IELTS, TOEIC, chứng chỉ kỹ năng hoặc giấy chứng nhận hội thảo quốc tế, hãy upload minh chứng."
  ]
};

async function getAISuggestions(
  student,
  missingCategories,
  completedCategories,
  awardLevel = CURRENT_AWARD_LEVEL
) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || missingCategories.length === 0) {
      return null;
    }

    const awardLevelLabelMap = {
      truong: "Cấp Trường",
      dhqg: "Cấp ĐHQG-HCM",
      thanh: "Cấp Thành phố Hồ Chí Minh"
    };

    const awardLevelLabel = awardLevelLabelMap[awardLevel] || "Cấp Trường";

    const completedLabels = completedCategories.map((category) => {
      return categoryLabels[category];
    });

    const missingDetails = missingCategories
      .map((category) => {
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
- Không dùng nhầm điều kiện cấp Trường nếu đang xét cấp ĐHQG-HCM hoặc cấp Thành phố.
- Nếu là cấp Thành phố, cần lưu ý các điều kiện có thể chặt hơn, đặc biệt ở Tình nguyện tốt và Hội nhập tốt.
- Mỗi đề xuất 1-2 câu, nêu rõ sinh viên nên bổ sung gì và minh chứng nào phù hợp.

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      console.error("Gemini suggestions error:", response.status);
      return null;
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
    const participant = activity.participants.find((p) => {
      return p.studentId === studentId;
    });

    const days =
      Number(participant?.volunteerDays || 0) ||
      Number(activity.volunteerDays || 0);

    volunteerDays += days;
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
  const hoiNhapEvidenceType = evidence.aiResult?.hoiNhapEvidenceType || "";

  if (isValidHoiNhapEvidenceForLevel(awardLevel, hoiNhapEvidenceType)) {
    subProgress.hoiNhap = true;
  }
}
  });

  relatedActivities.forEach((activity) => {
    const participant = activity.participants.find((p) => {
      return p.studentId === studentId;
    });

    const sub = participant?.subCriteria || activity.subCriteria || "";

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
    subProgress.ngoaiNgu && subProgress.kyNang && subProgress.hoiNhap;

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

module.exports = router;