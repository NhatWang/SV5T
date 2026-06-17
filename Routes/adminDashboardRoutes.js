const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");

function generateSecurityCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const Student = require("../Models/Student");
const Activity = require("../Models/Activity");
const Evidence = require("../Models/Evidence");
const ClassCollectiveEvaluation = require("../Models/ClassCollectiveEvaluation");
const Admin = require("../Models/Admin");
const CheckinSession = require("../Models/CheckinSession");

const {
  recomputeHocTapProgress,
  recomputeTinhNguyenProgress,
  recomputeHoiNhapProgress
} = require("../Utils/progressRecompute");

const {
  buildEvidenceKey,
  uploadLocalFileToR2,
  deleteFromR2
} = require("../Utils/r2Client");

const {
  requireAdminAuth,
  requireSuperAdmin,
  requireClassPermission
} = require("../Middlewares/authMiddleware");

const {
  normalizeOrganizerLevel,
  inferEligibleAwardLevels
} = require("../Utils/activityEligibility");

const {
  generateResetCode,
  hashResetCode
} = require("../Utils/resetPasswordUtils");

const SystemSettings = require("../Models/SystemSettings");
const { invalidateMaintenanceCache } = require("../Middlewares/maintenanceMiddleware");

const ClassSupport = require("../Models/ClassSupport");

const {
  sendPushToStudent,
  sendPushToStudents,
  sendPushBroadcast
} = require("../Utils/pushService");

const router = express.Router();

const upload = multer({
  dest: "uploads/excel/"
});

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
  hoiNhapTot: "Hội nhập tốt",
  khac: "Khác"
};

const hoiNhapSubCriteria = ["ngoaiNgu", "kyNang", "hoiNhap"];

const VALID_AWARD_LEVELS = ["truong", "dhqg", "thanh"];

const VALID_ORGANIZER_LEVELS = [
  "chi_hoi",
  "khoa",
  "truong",
  "dhqg",
  "thanh",
  "quoc_gia",
  "quoc_te",
  "khac"
];

function parseExcelDate(value) {
  if (!value) return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number") {
    const parsed = xlsx.SSF.parse_date_code(value);

    if (!parsed) return null;

    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) return null;

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split("/").map(Number);
      return new Date(year, month - 1, day);
    }

    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map(Number);
      return new Date(year, month - 1, day);
    }
  }

  return null;
}

function parseBooleanCell(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return ["true", "1", "yes", "y", "có", "co", "x"].includes(normalized);
}

function getCellValue(row, key) {
  return row[key] ? String(row[key]).trim() : "";
}

function getStudentCompletedCount(student) {
  let completed = 0;

  categories.forEach((category) => {
    if (
      student.sv5tProgress &&
      student.sv5tProgress[category] &&
      student.sv5tProgress[category].isCompleted
    ) {
      completed += 1;
    }
  });

  return completed;
}

function updateStudentProgressSummary(student) {
  const completed = getStudentCompletedCount(student);

  student.totalCompletedCriteria = completed;
  student.progressPercent = Math.round((completed / 5) * 100);

  if (completed === 0) {
    student.sv5tStatus = "not_started";
  } else if (completed < 5) {
    student.sv5tStatus = "in_progress";
  } else {
    student.sv5tStatus = "completed";
  }
}

async function archiveEvidenceToR2FromAdmin(evidence) {
  if (!evidence) return null;

  if (evidence.storageStatus === "r2_archived" && evidence.fileUrl) {
    return evidence;
  }

  if (!evidence.filePath || !fs.existsSync(evidence.filePath)) {
    return evidence;
  }

  const fileKey = buildEvidenceKey(evidence.studentId, evidence.fileName);

  const uploadedFile = await uploadLocalFileToR2({
    localPath: evidence.filePath,
    key: fileKey,
    contentType: evidence.fileType
  });

  evidence.fileKey = uploadedFile.key;
  evidence.fileUrl = uploadedFile.url;
  evidence.storageStatus = "r2_archived";

  if (fs.existsSync(evidence.filePath)) {
    fs.unlinkSync(evidence.filePath);
  }

  evidence.filePath = "";

  await evidence.save();

  return evidence;
}

async function deleteTempEvidenceFileFromAdmin(evidence) {
  if (!evidence) return null;

  if (evidence.storageStatus === "local_temp" && evidence.filePath) {
    if (fs.existsSync(evidence.filePath)) {
      fs.unlinkSync(evidence.filePath);
    }

    evidence.filePath = "";
    evidence.storageStatus = "deleted";
    await evidence.save();

    return evidence;
  }

  if (evidence.storageStatus === "r2_archived" && evidence.fileKey) {
    await deleteFromR2(evidence.fileKey);

    evidence.fileKey = "";
    evidence.fileUrl = "";
    evidence.storageStatus = "deleted";
    await evidence.save();

    return evidence;
  }

  return evidence;
}

function cleanupTempFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Cleanup temp file error:", error.message);
  }
}

async function recomputeSchoolProgressAfterEvidence(evidence) {
  if (!evidence || evidence.awardLevel !== "truong") {
    return;
  }

  if (evidence.category === "hocTapTot") {
    await recomputeHocTapProgress(evidence.studentId);
    return;
  }

  if (evidence.category === "tinhNguyenTot") {
    await recomputeTinhNguyenProgress(evidence.studentId);
    return;
  }

  if (evidence.category === "hoiNhapTot") {
    await recomputeHoiNhapProgress(evidence.studentId);
    return;
  }

  const student = await Student.findOne({
    studentId: evidence.studentId
  });

  if (
    student &&
    student.sv5tProgress &&
    student.sv5tProgress[evidence.category]
  ) {
    student.sv5tProgress[evidence.category].isCompleted = true;
    student.sv5tProgress[evidence.category].completedBy = "evidence";
    student.sv5tProgress[evidence.category].completedAt = new Date();

    updateStudentProgressSummary(student);

    await student.save();
  }
}

async function recomputeHigherLevelProgressAfterEvidence(evidence) {
  if (!evidence || !["dhqg", "thanh"].includes(evidence.awardLevel)) {
    return;
  }

  const student = await Student.findOne({
    studentId: evidence.studentId
  });

  if (!student) return;

  const level = evidence.awardLevel;

  const activities = await Activity.find({
    "participants.studentId": evidence.studentId,
    $or: [
      {
        eligibleAwardLevels: level
      },
      {
        eligibleAwardLevels: {
          $exists: false
        },
        awardLevel: level
      }
    ]
  }).lean();

  const evidences = await Evidence.find({
    studentId: evidence.studentId,
    $or: [
      {
        awardLevel: level
      },
      {
        awardLevel: "truong",
        category: {
          $in: ["hocTapTot", "theLucTot", "tinhNguyenTot", "hoiNhapTot"]
        },
        status: "approved_by_admin"
      }
    ]
  }).lean();

  const validEvidences = evidences.filter((item) => {
    return item.status === "approved_by_admin";
  });

  const storedProgress = {};

  categories.forEach((category) => {
    const relatedActivities = activities.filter((activity) => {
      return activity.category === category;
    });

    const relatedEvidences = validEvidences.filter((item) => {
      return item.category === category;
    });

    const hasActivity = relatedActivities.length > 0;
    const hasApprovedEvidence = relatedEvidences.length > 0;

    let isCompleted = false;
    let completedBy = "none";

    if (category === "daoDucTot") {
      isCompleted = student.sv5tProgress?.daoDucTot?.isCompleted === true;
      completedBy = isCompleted ? "reference_school" : "none";
    }

    if (category === "hocTapTot") {
      isCompleted =
        student.sv5tProgress?.hocTapTot?.isCompleted === true &&
        (hasActivity || hasApprovedEvidence);

      completedBy = isCompleted ? "reference_and_evidence" : "none";
    }

    if (category === "theLucTot") {
      isCompleted = hasActivity || hasApprovedEvidence;
      completedBy = hasActivity ? "activity" : hasApprovedEvidence ? "evidence" : "none";
    }

    if (category === "tinhNguyenTot") {
      let volunteerDays = 0;
      let hasVolunteerAward = false;

      relatedEvidences.forEach((item) => {
        volunteerDays += Number(item.aiResult?.volunteerDays || 0);

        const matchedType = String(item.aiResult?.matchedType || "").toLowerCase();

        if (
          item.aiResult?.hasVolunteerAward === true ||
          matchedType.includes("giấy khen") ||
          matchedType.includes("khen thưởng")
        ) {
          hasVolunteerAward = true;
        }
      });

      relatedActivities.forEach((activity) => {
        const participant = (activity.participants || []).find((p) => {
          return String(p.studentId) === String(evidence.studentId);
        });

        volunteerDays +=
          Number(participant?.volunteerDays || 0) ||
          Number(activity.volunteerDays || 0);

        const title = String(activity.title || "").toLowerCase();

        if (
          participant?.isVolunteerAward === true ||
          activity.isVolunteerAward === true ||
          title.includes("khen thưởng") ||
          title.includes("giấy khen") ||
          title.includes("giay khen") ||
          title.includes("khen thuong")
        ) {
          hasVolunteerAward = true;
        }
      });

      if (level === "thanh") {
        isCompleted = hasVolunteerAward && volunteerDays >= 5;
      } else {
        isCompleted = hasVolunteerAward || volunteerDays >= 5;
      }

      completedBy = isCompleted
        ? hasActivity && hasApprovedEvidence
          ? "activity_and_evidence"
          : hasActivity
          ? "activity"
          : "evidence"
        : "none";

      storedProgress[category] = {
        isCompleted,
        completedBy,
        completedAt: isCompleted ? new Date() : null,
        volunteerDays,
        hasVolunteerAward
      };

      return;
    }

    if (category === "hoiNhapTot") {
      const schoolHoiNhap = student.sv5tProgress?.hoiNhapTot || {};
      isCompleted = schoolHoiNhap.isCompleted === true || hasActivity || hasApprovedEvidence;

      completedBy = isCompleted
        ? hasActivity && hasApprovedEvidence
          ? "activity_and_evidence"
          : hasActivity
          ? "activity"
          : hasApprovedEvidence
          ? "evidence"
          : "reference_school"
        : "none";
    }

    storedProgress[category] = {
      isCompleted,
      completedBy,
      completedAt: isCompleted ? new Date() : null
    };
  });

  const completedCount = categories.filter((category) => {
    return storedProgress[category]?.isCompleted === true;
  }).length;

  const progressPercent = Math.round((completedCount / 5) * 100);

  if (level === "dhqg") {
    student.dhqgProgress = storedProgress;
    student.markModified("dhqgProgress");
  }

  if (level === "thanh") {
    student.thanhProgress = storedProgress;
    student.markModified("thanhProgress");
  }

  student.higherLevelStatus = student.higherLevelStatus || {};

  student.higherLevelStatus[level] = {
    completedCount,
    progressPercent,
    isCompleted: completedCount === 5,
    updatedAt: new Date()
  };

  student.markModified("higherLevelStatus");

  await student.save();
}

async function recomputeCentralProgressAfterEvidence(evidence) {
  if (!evidence || evidence.awardLevel !== "trung_uong") {
    return;
  }

  const student = await Student.findOne({
    studentId: evidence.studentId
  });

  if (!student) return;

  const centralEvidences = await Evidence.find({
    studentId: evidence.studentId,
    awardLevel: "trung_uong"
  }).lean();

  const centralProgress = {};

  categories.forEach((category) => {
    const previousProgress = student.centralProgress?.[category] || {};

    const hasApprovedMandatoryEvidence = centralEvidences.some((item) => {
      return (
        item.category === category &&
        item.status === "approved_by_admin" &&
        (
          item.evidenceType === "central_mandatory" ||
          item.evidenceType === "default" ||
          !item.evidenceType
        )
      );
    });

    const referencePassed = previousProgress.referencePassed === true;

    const isCompleted = referencePassed || hasApprovedMandatoryEvidence;

    centralProgress[category] = {
      isCompleted,
      completedBy: isCompleted
        ? referencePassed
          ? "reference_lower_level"
          : "admin_approved_mandatory_evidence"
        : "none",
      completedAt: isCompleted ? new Date() : null,

      adminApproved: hasApprovedMandatoryEvidence,
      referencePassed,

      status: isCompleted
        ? referencePassed
          ? "completed_by_reference"
          : "completed_by_admin"
        : "missing_reference"
    };
  });

  const approvedAdditionalKeys = new Set();

  centralEvidences.forEach((item) => {
    if (
      item.evidenceType === "central_additional" &&
      item.status === "approved_by_admin"
    ) {
      const key =
        item.additionalCriteriaKey ||
        item.centralAdditionalKey ||
        item.criteriaKey ||
        "";

      if (key) {
        approvedAdditionalKeys.add(key);
      }
    }
  });

  const completedCount = categories.filter((category) => {
    return centralProgress[category]?.isCompleted === true;
  }).length;

  const progressPercent = Math.round((completedCount / 5) * 100);

  const additionalCriteriaCount = approvedAdditionalKeys.size;

  const additionalProgressPercent = Math.round(
    (Math.min(additionalCriteriaCount, 2) / 2) * 100
  );

  student.centralProgress = centralProgress;

  student.centralSummary = {
    mandatoryCompletedCount: completedCount,
    mandatoryProgressPercent: progressPercent,
    additionalCriteriaCount,
    additionalProgressPercent,
    isCentralQualified:
      completedCount === 5 && additionalCriteriaCount >= 2,
    updatedAt: new Date()
  };

  student.markModified("centralProgress");
  student.markModified("centralSummary");

  await student.save();
}

async function recomputeHigherLevelProgressForStudent(studentId, level) {
  if (!studentId || !["dhqg", "thanh"].includes(level)) {
    return;
  }

  const student = await Student.findOne({
    studentId
  });

  if (!student) return;

  const activities = await Activity.find({
    "participants.studentId": studentId,
    eligibleAwardLevels: level
  }).lean();

  const evidences = await Evidence.find({
    studentId,
    awardLevel: level,
    status: "approved_by_admin"
  }).lean();

  const storedProgress = {};

  categories.forEach((category) => {
    const relatedActivities = activities.filter((activity) => {
      return activity.category === category;
    });

    const relatedEvidences = evidences.filter((item) => {
      return item.category === category;
    });

    const hasActivity = relatedActivities.length > 0;
    const hasApprovedEvidence = relatedEvidences.length > 0;

    let isCompleted = false;
    let completedBy = "none";

    if (category === "daoDucTot") {
      isCompleted = student.sv5tProgress?.daoDucTot?.isCompleted === true;
      completedBy = isCompleted ? "reference_school" : "none";
    }

    if (category === "hocTapTot") {
      isCompleted =
        student.sv5tProgress?.hocTapTot?.isCompleted === true &&
        (hasActivity || hasApprovedEvidence);

      completedBy = isCompleted ? "reference_and_activity_or_evidence" : "none";
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
      let volunteerDays = 0;
      let hasVolunteerAward = false;

      relatedEvidences.forEach((item) => {
        volunteerDays += Number(item.aiResult?.volunteerDays || 0);

        const matchedType = String(item.aiResult?.matchedType || "").toLowerCase();

        if (
          item.aiResult?.hasVolunteerAward === true ||
          matchedType.includes("giấy khen") ||
          matchedType.includes("khen thưởng") ||
          matchedType.includes("giay khen") ||
          matchedType.includes("khen thuong")
        ) {
          hasVolunteerAward = true;
        }
      });

      relatedActivities.forEach((activity) => {
        const participant = (activity.participants || []).find((p) => {
          return String(p.studentId) === String(studentId);
        });

        volunteerDays +=
          Number(participant?.volunteerDays || 0) ||
          Number(activity.volunteerDays || 0);

        const title = String(activity.title || "").toLowerCase();

        if (
          participant?.isVolunteerAward === true ||
          activity.isVolunteerAward === true ||
          title.includes("khen thưởng") ||
          title.includes("giấy khen") ||
          title.includes("giay khen") ||
          title.includes("khen thuong")
        ) {
          hasVolunteerAward = true;
        }
      });

      if (level === "thanh") {
        isCompleted = hasVolunteerAward && volunteerDays >= 5;
      } else {
        isCompleted = hasVolunteerAward || volunteerDays >= 5;
      }

      completedBy = isCompleted
        ? hasActivity && hasApprovedEvidence
          ? "activity_and_evidence"
          : hasActivity
          ? "activity"
          : "evidence"
        : "none";

      storedProgress[category] = {
        isCompleted,
        completedBy,
        completedAt: isCompleted ? new Date() : null,
        volunteerDays,
        hasVolunteerAward
      };

      return;
    }

    if (category === "hoiNhapTot") {
      const schoolHoiNhap = student.sv5tProgress?.hoiNhapTot || {};

      isCompleted =
        schoolHoiNhap.isCompleted === true ||
        hasActivity ||
        hasApprovedEvidence;

      completedBy = isCompleted
        ? hasActivity && hasApprovedEvidence
          ? "activity_and_evidence"
          : hasActivity
          ? "activity"
          : hasApprovedEvidence
          ? "evidence"
          : "reference_school"
        : "none";
    }

    storedProgress[category] = {
      isCompleted,
      completedBy,
      completedAt: isCompleted ? new Date() : null
    };
  });

  const completedCount = categories.filter((category) => {
    return storedProgress[category]?.isCompleted === true;
  }).length;

  const progressPercent = Math.round((completedCount / 5) * 100);

  if (level === "dhqg") {
    student.dhqgProgress = storedProgress;
    student.markModified("dhqgProgress");
  }

  if (level === "thanh") {
    student.thanhProgress = storedProgress;
    student.markModified("thanhProgress");
  }

  student.higherLevelStatus = student.higherLevelStatus || {};

  student.higherLevelStatus[level] = {
    completedCount,
    progressPercent,
    isCompleted: completedCount === 5,
    updatedAt: new Date()
  };

  student.markModified("higherLevelStatus");

  await student.save();
}

async function evaluateCollectiveTitle(
  className,
  totalStudents,
  completedStudents
) {
  const config =
    (await ClassCollectiveEvaluation.findOne({ className })) || {
      chiHoiRating: "unknown",
      hasRegistrationForm: false,
      hasSupportActivities: false,
      hasViolation: false
    };

  const requiredPercent = totalStudents < 100 ? 30 : 15;

  const requiredStudentCount =
    totalStudents > 0 ? Math.ceil((totalStudents * requiredPercent) / 100) : 0;

  const completedPercent =
    totalStudents > 0
      ? Math.round((completedStudents / totalStudents) * 100)
      : 0;

  const checks = {
    chiHoiRatingStrong: config.chiHoiRating === "manh",
    hasRegistrationForm: config.hasRegistrationForm === true,
    hasSupportActivities: config.hasSupportActivities === true,
    enoughSv5tRate: completedStudents >= requiredStudentCount,
    noViolation: config.hasViolation === false
  };

  const isCollectiveAchieved =
    checks.chiHoiRatingStrong &&
    checks.hasRegistrationForm &&
    checks.hasSupportActivities &&
    checks.enoughSv5tRate &&
    checks.noViolation;

  return {
    isCollectiveAchieved,
    requiredPercent,
    requiredStudentCount,
    completedPercent,
    checks,
    manualData: {
      chiHoiRating: config.chiHoiRating,
      hasRegistrationForm: config.hasRegistrationForm,
      hasSupportActivities: config.hasSupportActivities,
      hasViolation: config.hasViolation
    },
    note:
      totalStudents < 100
        ? "Chi Hội dưới 100 sinh viên cần ít nhất 30% sinh viên đạt danh hiệu Sinh viên 5 tốt."
        : "Chi Hội từ 100 sinh viên trở lên cần ít nhất 15% sinh viên đạt danh hiệu Sinh viên 5 tốt."
  };
}

function normalizeKyNangEvidenceType(value) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Nếu admin nhập đúng mã kỹ thuật thì giữ nguyên
  const validTypes = [
    "skill_course",
    "skill_competition_award_khoa_or_above",
    "skill_competition_award_truong_or_above",
    "skill_reporter_khoa_or_above",
    "skill_reporter_truong_or_above",
    "union_association_award_truong_or_above",
    "student_leader_competition_finalist_truong_or_above"
  ];

  if (validTypes.includes(raw)) {
    return raw;
  }

  if (
    normalized.includes("khoa ky nang") ||
    normalized.includes("lop ky nang") ||
    normalized.includes("hoan thanh") && normalized.includes("ky nang")
  ) {
    return "skill_course";
  }

  if (
    normalized.includes("giai") &&
    normalized.includes("cuoc thi") &&
    normalized.includes("ky nang") &&
    normalized.includes("cap khoa")
  ) {
    return "skill_competition_award_khoa_or_above";
  }

  if (
    normalized.includes("giai") &&
    normalized.includes("cuoc thi") &&
    normalized.includes("ky nang") &&
    normalized.includes("cap truong")
  ) {
    return "skill_competition_award_truong_or_above";
  }

  if (
    normalized.includes("bao cao vien") &&
    normalized.includes("cap khoa")
  ) {
    return "skill_reporter_khoa_or_above";
  }

  if (
    normalized.includes("bao cao vien") &&
    normalized.includes("cap truong")
  ) {
    return "skill_reporter_truong_or_above";
  }

  if (
    normalized.includes("khen thuong") &&
    (normalized.includes("doan") || normalized.includes("hoi"))
  ) {
    return "union_association_award_truong_or_above";
  }

  if (
    normalized.includes("thu linh sinh vien") ||
    normalized.includes("chung ket")
  ) {
    return "student_leader_competition_finalist_truong_or_above";
  }

  return "";
}

function normalizeHoiNhapEvidenceType(value) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const validTypes = [
    "international_exchange",
    "integration_competition_khoa_or_above",
    "integration_competition_award_truong_or_above",
    "foreign_language_academic_competition_award_truong_or_above",
    "official_international_program_member",
    "international_program_volunteer",
    "integration_activity_truong_or_above"
  ];

  if (validTypes.includes(raw)) {
    return raw;
  }

  if (
    normalized.includes("giao luu quoc te") ||
    normalized.includes("hoi nghi quoc te") ||
    normalized.includes("hoi thao quoc te")
  ) {
    return "international_exchange";
  }

  if (
    normalized.includes("cuoc thi") &&
    normalized.includes("hoi nhap") &&
    normalized.includes("cap khoa")
  ) {
    return "integration_competition_khoa_or_above";
  }

  if (
    normalized.includes("giai") &&
    normalized.includes("hoi nhap") &&
    normalized.includes("cap truong")
  ) {
    return "integration_competition_award_truong_or_above";
  }

  if (
    normalized.includes("hoc thuat bang ngoai ngu") ||
    normalized.includes("cuoc thi bang ngoai ngu")
  ) {
    return "foreign_language_academic_competition_award_truong_or_above";
  }

  if (
    normalized.includes("thanh vien chinh thuc") &&
    (normalized.includes("giao luu") || normalized.includes("hop tac quoc te"))
  ) {
    return "official_international_program_member";
  }

  if (
    normalized.includes("tinh nguyen vien") &&
    (normalized.includes("giao luu") || normalized.includes("quoc te"))
  ) {
    return "international_program_volunteer";
  }

  if (
    normalized.includes("hoat dong hoi nhap") ||
    normalized.includes("hoi nhap cap truong")
  ) {
    return "integration_activity_truong_or_above";
  }

  return "";
}

// ===============================
// 1. ADMIN: XEM SINH VIÊN TRONG chi Hội
// ===============================

router.get(
  "/class/:className/students",
  requireAdminAuth,
  async (req, res) => {
    try {
      const { className } = req.params;
      if (req.admin.role === "admin" && req.admin.className !== className) {
  return res.status(403).json({
    success: false,
    message: "Bạn chỉ được xem danh sách sinh viên của chi Hội mình."
  });
}

      const students = await Student.find({ className }).select("-password").sort({ studentId: 1 });

      const result = students.map((student) => {
        return {
          studentId: student.studentId,
          fullName: student.fullName,
          className: student.className,
          sv5tProgress: student.sv5tProgress,
          totalCompletedCriteria: student.totalCompletedCriteria,
          progressPercent: student.progressPercent,
          sv5tStatus: student.sv5tStatus
        };
      });

      res.json({
        success: true,
        className,
        totalStudents: result.length,
        students: result
      });
    } catch (error) {
      console.error("Get class students error:", error);

      res.status(500).json({
        success: false,
        message: "Lỗi server khi lấy danh sách sinh viên trong chi Hội"
      });
    }
  }
);

// ===============================
// 2. ADMIN: XEM TIẾN ĐỘ TẬP THỂ CỦA chi Hội
// ===============================

router.get(
  "/class/:className/collective-progress",
  requireAdminAuth,
  requireClassPermission,
  async (req, res) => {
    try {
      const { className } = req.params;

      const students = await Student.find({ className }).select("-password");

      const totalStudents = students.length;

      const completedStudents = students.filter(
        (student) => student.totalCompletedCriteria === 5
      ).length;

      const inProgressStudents = students.filter(
        (student) =>
          student.totalCompletedCriteria > 0 &&
          student.totalCompletedCriteria < 5
      ).length;

      const notStartedStudents = students.filter(
        (student) => student.totalCompletedCriteria === 0
      ).length;

      const categoryStats = {};

      categories.forEach((category) => {
        const count = students.filter(
          (student) =>
            student.sv5tProgress &&
            student.sv5tProgress[category] &&
            student.sv5tProgress[category].isCompleted
        ).length;

        categoryStats[category] = {
          label: categoryLabels[category],
          completedCount: count,
          percent:
            totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0
        };
      });

      const completedPercent =
        totalStudents > 0
          ? Math.round((completedStudents / totalStudents) * 100)
          : 0;

      const collectiveEvaluation = await evaluateCollectiveTitle(
        className,
        totalStudents,
        completedStudents
      );

      res.json({
        success: true,
        className,
        totalStudents,
        completedStudents,
        inProgressStudents,
        notStartedStudents,
        completedPercent,
        categoryStats,

        collectiveProgress: {
          currentPercent: completedPercent,
          requiredPercent: collectiveEvaluation.requiredPercent,
          isCollectiveAchieved: collectiveEvaluation.isCollectiveAchieved,
          checks: collectiveEvaluation.checks,
          manualData: collectiveEvaluation.manualData,
          note: collectiveEvaluation.note,
          requiredStudentCount: collectiveEvaluation.requiredStudentCount,

          criteria: {
            chiHoiRatingStrong:
              "Đánh giá chất lượng Chi Hội cuối năm xếp loại Mạnh.",
            hasRegistrationForm:
              "Có hình thức cụ thể để sinh viên đăng ký phấn đấu trở thành Sinh viên 5 tốt.",
            hasSupportActivities:
              "Có hoạt động tạo môi trường cho sinh viên phấn đấu đạt danh hiệu Sinh viên 5 tốt.",
            enoughSv5tRate:
              totalStudents < 100
                ? "Chi Hội dưới 100 sinh viên cần ít nhất 30% sinh viên đạt danh hiệu Sinh viên 5 tốt."
                : "Chi Hội từ 100 sinh viên trở lên cần ít nhất 15% sinh viên đạt danh hiệu Sinh viên 5 tốt.",
            noViolation:
              "Không có sinh viên vi phạm pháp luật, quy chế, nội quy của Nhà trường, địa phương và cộng đồng."
          }
        }
      });
    } catch (error) {
      console.error("Collective progress error:", error);

      res.status(500).json({
        success: false,
        message: "Lỗi server khi tính tiến độ tập thể"
      });
    }
  }
);

// Helper functions for sv5t-detail route
function buildLevelMissingItems(category, level, levelProgress) {
  if (!category || !level) return [];

  if (category === "khac") {
    return [];
  }
  const isCompleted = levelProgress?.isCompleted === true;

  if (isCompleted) {
    return [];
  }

  if (level === "truong") {
    const missingMap = {
      daoDucTot: [
        "Cần hoàn tất điều kiện điểm rèn luyện và xác nhận không vi phạm.",
        "Nếu thiếu dữ liệu hệ thống, sinh viên cần tự khai hoặc nộp minh chứng phù hợp."
      ],
      hocTapTot: [
        "Cần đạt điều kiện học tập bắt buộc.",
        "Cần có minh chứng học thuật hoặc hoạt động học thuật phù hợp."
      ],
      theLucTot: [
        "Cần có hoạt động thể thao, giải thể thao hoặc minh chứng thể lực phù hợp."
      ],
      tinhNguyenTot: [
        "Cần đủ ngày tình nguyện hoặc minh chứng/khen thưởng tình nguyện phù hợp."
      ],
      hoiNhapTot: [
        "Cần đủ 3 phần: ngoại ngữ, kỹ năng và hoạt động hội nhập."
      ],
      khac: []
    };
    return missingMap[category] || [];
  }

  if (level === "dhqg") {
    const dhqgMissingMap = {
      daoDucTot: ["Cần đạt Đạo đức tốt cấp Trường và đủ điều kiện tham chiếu lên cấp ĐHQG-HCM."],
      hocTapTot: ["Cần đạt Học tập tốt cấp Trường và có hoạt động/minh chứng học tập đủ điều kiện cấp ĐHQG-HCM."],
      theLucTot: ["Cần có hoạt động hoặc minh chứng thể lực đủ điều kiện cấp ĐHQG-HCM."],
      tinhNguyenTot: ["Cần có đủ ngày tình nguyện hoặc khen thưởng tình nguyện phù hợp cấp ĐHQG-HCM."],
      hoiNhapTot: ["Cần đạt đủ điều kiện Hội nhập tốt theo quy định cấp ĐHQG-HCM."]
    };
    return dhqgMissingMap[category] || [];
  }

  if (level === "thanh") {
    const thanhMissingMap = {
      daoDucTot: ["Cần đạt Đạo đức tốt cấp Trường và đủ điều kiện tham chiếu lên cấp Thành phố."],
      hocTapTot: ["Cần đạt Học tập tốt cấp Trường và có hoạt động/minh chứng học tập đủ điều kiện cấp Thành phố."],
      theLucTot: ["Cần có hoạt động hoặc minh chứng thể lực đủ điều kiện cấp Thành phố."],
      tinhNguyenTot: ["Cấp Thành phố yêu cầu vừa đủ ít nhất 05 ngày tình nguyện, vừa có khen thưởng/xác nhận tình nguyện phù hợp."],
      hoiNhapTot: ["Cần đạt đủ 3 phần Hội nhập tốt: Ngoại ngữ, Kỹ năng và Hoạt động hội nhập theo quy định cấp Thành phố."]
    };
    return thanhMissingMap[category] || [];
  }

  if (level === "trung_uong") {
    const centralMissingMap = {
      daoDucTot: ["Cần đạt tiêu chuẩn bắt buộc Đạo đức tốt cấp Trung ương hoặc có minh chứng bắt buộc đã được admin duyệt."],
      hocTapTot: ["Cần đạt tiêu chuẩn bắt buộc Học tập tốt cấp Trung ương hoặc có minh chứng bắt buộc đã được admin duyệt."],
      theLucTot: ["Cần đạt tiêu chuẩn bắt buộc Thể lực tốt cấp Trung ương hoặc có minh chứng bắt buộc đã được admin duyệt."],
      tinhNguyenTot: ["Cần đạt tiêu chuẩn bắt buộc Tình nguyện tốt cấp Trung ương hoặc có minh chứng bắt buộc đã được admin duyệt."],
      hoiNhapTot: ["Cần đạt tiêu chuẩn bắt buộc Hội nhập tốt cấp Trung ương hoặc có minh chứng bắt buộc đã được admin duyệt."]
    };
    return centralMissingMap[category] || [];
  }

  return [];
}

function getSelfDeclarationsByCategoryAndLevel(student, category, level) {
  return (student.selfDeclarations || []).filter((item) => {
    return item.category === category && item.awardLevel === level;
  });
}

function formatDeclarationValue(value) {
  if (value === true) return "Có";
  if (value === false) return "Không";
  if (value === null || value === undefined || value === "") return "Chưa khai";
  return String(value);
}

function buildDeclarationForLevel(student, category, level) {
  const declarations = getSelfDeclarationsByCategoryAndLevel(student, category, level);

  if (!declarations.length) {
    return { title: "Dữ liệu sinh viên tự khai", groups: [] };
  }

  const groups = declarations.map((declaration) => {
    const data = declaration.data || {};
    const items = Object.keys(data).map((key) => ({
      label: key,
      value: formatDeclarationValue(data[key])
    }));
    return {
      title: declaration.type || declaration.subCriteria || "Tự khai",
      awardLevel: declaration.awardLevel || level,
      category: declaration.category || category,
      subCriteria: declaration.subCriteria || "",
      type: declaration.type || "",
      isCompleted: declaration.isCompleted === true,
      reason: declaration.reason || "",
      declaredAt: declaration.declaredAt || null,
      items
    };
  });

  return { title: "Dữ liệu sinh viên tự khai", groups };
}

router.get(
  "/students/:studentId/sv5t-detail",
  requireAdminAuth,
  async (req, res) => {
    try {
      const studentId = req.params.studentId;

      const student = await Student.findOne({
        studentId
      }).select("-password");

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy sinh viên."
        });
      }

      if (
        req.admin.role === "admin" &&
        student.className !== req.admin.className
      ) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xem sinh viên ngoài chi Hội mình."
        });
      }

      const activities = await Activity.find({
        "participants.studentId": studentId
      })
        .sort({ date: -1 })
        .lean();

      const evidences = await Evidence.find({
        studentId
      })
        .sort({ createdAt: -1 })
        .lean();

      const categoryKeys = [
        "daoDucTot",
        "hocTapTot",
        "theLucTot",
        "tinhNguyenTot",
        "hoiNhapTot",
        "khac"
      ];

      const missingMap = {
        daoDucTot: [
          "Cần hoàn tất điều kiện điểm rèn luyện và xác nhận không vi phạm.",
          "Nếu thiếu dữ liệu hệ thống, sinh viên cần tự khai hoặc nộp minh chứng phù hợp."
        ],

        hocTapTot: [
          "Cần đạt điều kiện học tập bắt buộc.",
          "Cần có minh chứng học thuật hoặc hoạt động học thuật phù hợp."
        ],

        theLucTot: [
          "Cần có hoạt động thể thao, giải thể thao hoặc minh chứng thể lực phù hợp."
        ],

        tinhNguyenTot: [
          "Cần đủ ngày tình nguyện hoặc minh chứng/khen thưởng tình nguyện phù hợp."
        ],

        hoiNhapTot: [
          "Cần đủ 3 phần: ngoại ngữ, kỹ năng và hoạt động hội nhập."
        ],
        khac: []
      };

      const levelKeys = ["truong", "dhqg", "thanh", "trung_uong"];

      const levelLabels = {
        truong: "Cấp Trường",
        dhqg: "Cấp ĐHQG-HCM",
        thanh: "Cấp Thành phố",
        trung_uong: "Cấp Trung ương"
      };

      function getStudentProgressByLevel(student, level, category) {
        if (category === "khac") {
          return {
            isCompleted: null,
            completedBy: "supplementary",
            completedAt: null
          };
        }

        if (level === "truong") {
          return student.sv5tProgress?.[category] || {};
        }

        if (level === "dhqg") {
          return student.dhqgProgress?.[category] || {};
        }

        if (level === "thanh") {
          return student.thanhProgress?.[category] || {};
        }

        if (level === "trung_uong") {
          return student.centralProgress?.[category] || {};
        }

        return {};
      }

      function getEvidenceForLevel(evidence, level) {
        if (level === "truong") {
          return evidence.awardLevel === "truong";
        }

        if (level === "dhqg") {
          return evidence.awardLevel === "dhqg";
        }

        if (level === "thanh") {
          return evidence.awardLevel === "thanh";
        }

        if (level === "trung_uong") {
          return evidence.awardLevel === "trung_uong";
        }

        return false;
      }

      function getActivityForLevel(activity, level) {
        const eligibleAwardLevels = Array.isArray(activity.eligibleAwardLevels)
          ? activity.eligibleAwardLevels
          : [];

        if (eligibleAwardLevels.includes(level)) {
          return true;
        }

        if (
          eligibleAwardLevels.length === 0 &&
          activity.awardLevel === level
        ) {
          return true;
        }

        return false;
      }

      const details = {};

      categoryKeys.forEach((category) => {
        const progress = student.sv5tProgress?.[category] || {};
        const isCompleted = progress.isCompleted === true;

        const categoryActivities = activities.filter((activity) => {
          return activity.category === category;
        });

        const categoryEvidences = evidences.filter((evidence) => {
          return evidence.category === category;
        });

        const levels = {};

        levelKeys.forEach((level) => {
          const levelProgress = getStudentProgressByLevel(
            student,
            level,
            category
          );

          const levelActivities = categoryActivities.filter((activity) => {
            return getActivityForLevel(activity, level);
          });

          const levelEvidences = categoryEvidences.filter((evidence) => {
            return getEvidenceForLevel(evidence, level);
          });

          const approvedEvidences = levelEvidences.filter((evidence) => {
            return ["approved_by_admin", "ai_valid"].includes(evidence.status);
          });

          const otherEvidences = levelEvidences.filter((evidence) => {
            return !["approved_by_admin", "ai_valid"].includes(evidence.status);
          });

          levels[level] = {
  level,
  label: levelLabels[level],
  isCompleted: levelProgress.isCompleted === true,
  completedBy: levelProgress.completedBy || "none",
  completedAt: levelProgress.completedAt || null,
  progress: levelProgress,

  declaration: buildDeclarationForLevel(student, category, level),

  activities: levelActivities,
  approvedEvidences,
  otherEvidences,

  missingItems: buildLevelMissingItems(
    category,
    level,
    levelProgress
  )
};
        });

        details[category] = {
          isCompleted,
          completedBy: progress.completedBy || "none",
          completedAt: progress.completedAt || null,

          progress,
          levels,

          activities: categoryActivities,

          approvedEvidences: categoryEvidences.filter((evidence) => {
            return ["approved_by_admin", "ai_valid"].includes(evidence.status);
          }),

          otherEvidences: categoryEvidences.filter((evidence) => {
            return !["approved_by_admin", "ai_valid"].includes(evidence.status);
          }),

          missingItems: isCompleted ? [] : missingMap[category]
        };
      });

      return res.json({
        success: true,
        student: {
          studentId: student.studentId,
          fullName: student.fullName,
          className: student.className,
          sv5tStatus: student.sv5tStatus
        },
        completedCount: student.totalCompletedCriteria || 0,
        progressPercent: student.progressPercent || 0,
        details
      });
    } catch (error) {
      console.error("Get student SV5T detail error:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi lấy chi tiết hồ sơ sinh viên."
      });
    }
  }
);


// ===============================
// 3. SUPER ADMIN: XEM TIẾN ĐỘ TẤT CẢ chi Hội
// ===============================

router.get(
  "/classes/summary",
  requireAdminAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const students = await Student.find().select("-password");

      const classMap = {};

      students.forEach((student) => {
        const className = student.className || "Chưa cập nhật";

        if (!classMap[className]) {
          classMap[className] = [];
        }

        classMap[className].push(student);
      });

      const summaries = await Promise.all(
        Object.keys(classMap).map(async (className) => {
          const classStudents = classMap[className];
          const totalStudents = classStudents.length;

          const completedStudents = classStudents.filter(
            (student) => student.totalCompletedCriteria === 5
          ).length;

          const completedPercent =
            totalStudents > 0
              ? Math.round((completedStudents / totalStudents) * 100)
              : 0;

          const categoryStats = {};

          categories.forEach((category) => {
            const count = classStudents.filter(
              (student) =>
                student.sv5tProgress &&
                student.sv5tProgress[category] &&
                student.sv5tProgress[category].isCompleted
            ).length;

            categoryStats[category] = {
              label: categoryLabels[category],
              completedCount: count,
              percent:
                totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0
            };
          });

          const collectiveEvaluation = await evaluateCollectiveTitle(
            className,
            totalStudents,
            completedStudents
          );

          return {
            className,
            totalStudents,
            completedStudents,
            completedPercent,
            categoryStats,

            collectiveProgress: {
              requiredPercent: collectiveEvaluation.requiredPercent,
              requiredStudentCount: collectiveEvaluation.requiredStudentCount,
              isCollectiveAchieved: collectiveEvaluation.isCollectiveAchieved,
              checks: collectiveEvaluation.checks,
              manualData: collectiveEvaluation.manualData,
              note: collectiveEvaluation.note
            }
          };
        })
      );

      const achievedCollectives = summaries.filter(
        (item) => item.collectiveProgress.isCollectiveAchieved
      ).length;

      res.json({
        success: true,
        totalClasses: summaries.length,
        achievedCollectives,
        summaries
      });
    } catch (error) {
      console.error("Class summary error:", error);

      res.status(500).json({
        success: false,
        message: "Lỗi server khi lấy tiến độ tổng các chi Hội"
      });
    }
  }
);

// ===============================
// 4. ADMIN: CẬP NHẬT ĐÁNH GIÁ TẬP THỂ CHI HỘI
// ===============================

router.post(
  "/class/:className/collective-evaluation",
  requireAdminAuth,
  async (req, res) => {
    try {
      const { className } = req.params;

      if (req.admin.role === "admin" && className !== req.admin.className) {
        return res.status(403).json({
          success: false,
          message: "Bạn chỉ được cập nhật đánh giá Chi Hội của chi Hội mình"
        });
      }

      if (req.admin.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Chỉ admin chi Hội được cập nhật đánh giá Chi Hội"
        });
      }

      const {
        chiHoiRating,
        hasRegistrationForm,
        hasSupportActivities,
        hasViolation
      } = req.body;

      const validRatings = ["manh", "kha", "trung_binh", "yeu", "unknown"];

      if (!validRatings.includes(chiHoiRating)) {
        return res.status(400).json({
          success: false,
          message: "Xếp loại Chi Hội không hợp lệ"
        });
      }

      const evaluation = await ClassCollectiveEvaluation.findOneAndUpdate(
        { className },
        {
          className,
          chiHoiRating,
          hasRegistrationForm: hasRegistrationForm === true,
          hasSupportActivities: hasSupportActivities === true,
          hasViolation: hasViolation === true,
          updatedBy: req.admin.username
        },
        {
          returnDocument: 'after',
          upsert: true
        }
      );

      res.json({
        success: true,
        message: "Cập nhật đánh giá tập thể Chi Hội thành công",
        evaluation
      });
    } catch (error) {
      console.error("Update collective evaluation error:", error);

      res.status(500).json({
        success: false,
        message: "Lỗi server khi cập nhật đánh giá tập thể Chi Hội"
      });
    }
  }
);

// ===============================
// 5. ADMIN / SUPER ADMIN: UPLOAD DANH SÁCH SINH VIÊN BẰNG EXCEL
// ===============================

router.post(
  "/upload-students",
  requireAdminAuth,
  upload.single("file"),
  async (req, res) => {
    const tempFilePath = req.file?.path;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng upload file Excel"
        });
      }

      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const errors = [];
      const validStudents = [];

      const seenStudentIds = new Set();

      for (const row of rows) {
        const studentId = getCellValue(row, "studentId");
        const fullName = getCellValue(row, "fullName");
        const className = getCellValue(row, "className");

        if (!studentId || !fullName || !className) {
          errors.push({
            row,
            reason: "Thiếu studentId, fullName hoặc className"
          });
          continue;
        }

        if (seenStudentIds.has(studentId)) {
          errors.push({
            row,
            reason: `MSSV ${studentId} bị trùng trong file Excel`
          });
          continue;
        }

        seenStudentIds.add(studentId);

        if (req.admin.role === "admin" && className !== req.admin.className) {
          errors.push({
            row,
            reason: `Admin chi Hội ${req.admin.className} không được upload sinh viên chi Hội ${className}`
          });
          continue;
        }

        validStudents.push({
          studentId,
          fullName,
          className
        });
      }

      if (validStudents.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Không có dòng sinh viên hợp lệ để upload",
          inserted: 0,
          updated: 0,
          totalRows: rows.length,
          errors
        });
      }

      const studentIds = validStudents.map((item) => item.studentId);

      const existingStudents = await Student.find({
        studentId: { $in: studentIds }
      }).select("studentId").lean();

      if (existingStudents.length > 0) {
        const duplicateIds = existingStudents.map((s) => s.studentId);
        return res.status(400).json({
          success: false,
          message: `${duplicateIds.length} MSSV đã tồn tại trong hệ thống: ${duplicateIds.join(", ")}`,
          duplicateIds
        });
      }

      const operations = validStudents.map((item) => ({
        insertOne: { document: {
          studentId:              item.studentId,
          fullName:               item.fullName,
          className:              item.className,
          isActivated:            false,
          password:               null,
          sv5tStatus:             "not_started",
          sv5tProgress:           {},
          totalCompletedCriteria: 0,
          progressPercent:        0,
          createdAt:              new Date()
        }}
      }));

      await Student.bulkWrite(operations, { ordered: false });

      return res.json({
        success: true,
        message: "Upload danh sách sinh viên thành công",
        inserted: validStudents.length,
        totalRows: rows.length,
        validRows: validStudents.length,
        errors
      });
    } catch (error) {
      console.error("Upload students error:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi upload danh sách sinh viên"
      });
    } finally {
      cleanupTempFile(tempFilePath);
    }
  }
);

// ===============================
// 6. ADMIN / SUPER ADMIN: UPLOAD DANH SÁCH HOẠT ĐỘNG BẰNG EXCEL
// ===============================

router.post(
  "/upload-activities",
  requireAdminAuth,
  upload.single("file"),
  async (req, res) => {
    const tempFilePath = req.file?.path;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng upload file Excel"
        });
      }

      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const activityMap = {};
      const errors = [];
      const affectedStudentIds = new Set();

      for (const row of rows) {
        const volunteerDays = Number(row.volunteerDays || 0);
        const academicEvidenceType = getCellValue(row, "academicEvidenceType");
        const title = getCellValue(row, "title");
        const category = getCellValue(row, "category");
        const subCriteria = getCellValue(row, "subCriteria");
        const organizerLevelRaw = getCellValue(row, "organizerLevel");
        const organizerLevel = normalizeOrganizerLevel(organizerLevelRaw);
        const date = parseExcelDate(row.date);
        const studentId = getCellValue(row, "studentId");
        const fullName = getCellValue(row, "fullName");
        const className = getCellValue(row, "className");

        const kyNangEvidenceType = normalizeKyNangEvidenceType(
          row.kyNangEvidenceType ||
            row["Loại minh chứng kỹ năng"] ||
            row["Loai minh chung ky nang"] ||
            row["Loại kỹ năng"] ||
            row["Loai ky nang"]
        );

        const hoiNhapEvidenceType = normalizeHoiNhapEvidenceType(
          row.hoiNhapEvidenceType ||
            row["Loại minh chứng hội nhập"] ||
            row["Loai minh chung hoi nhap"] ||
            row["Loại hoạt động hội nhập"] ||
            row["Loai hoat dong hoi nhap"]
        );

        const isVolunteerAward = parseBooleanCell(
          row.isVolunteerAward ||
            row["isVolunteerAward"] ||
            row["Khen thưởng tình nguyện"] ||
            row["Khen thuong tinh nguyen"]
        );

        if (!title || !category || !studentId) {
          errors.push({
            row,
            reason: "Thiếu title, category hoặc studentId"
          });
          continue;
        }

        if (!organizerLevelRaw) {
          errors.push({
            row,
            reason:
              "Thiếu organizerLevel. Vui lòng nhập cấp tổ chức: chi_hoi, khoa, truong, dhqg, thanh, quoc_gia hoặc quoc_te."
          });
          continue;
        }

        if (organizerLevel === "khac") {
          errors.push({
            row,
            reason:
              "organizerLevel không hợp lệ. Chỉ được dùng: chi_hoi, khoa, truong, dhqg, thanh, quoc_gia hoặc quoc_te."
          });
          continue;
        }

        if (!categories.includes(category)) {
          errors.push({
            row,
            reason:
              "category không hợp lệ. Chỉ được dùng: daoDucTot, hocTapTot, theLucTot, tinhNguyenTot, hoiNhapTot"
          });
          continue;
        }

        if (req.admin.role === "admin" && className !== req.admin.className) {
          errors.push({
            row,
            reason: `Admin chi Hội ${req.admin.className} không được upload hoạt động cho chi Hội ${className}`
          });
          continue;
        }

        if (req.admin.role === "admin" && organizerLevel !== "chi_hoi") {
          errors.push({
            row,
            reason: `Admin chi Hội chỉ được upload hoạt động cấp Chi Hội. Hoạt động "${title}" có cấp "${organizerLevel || organizerLevelRaw}" không hợp lệ.`
          });
          continue;
        }

        if (
          category === "hoiNhapTot" &&
          !hoiNhapSubCriteria.includes(subCriteria)
        ) {
          errors.push({
            row,
            reason:
              "Hoạt động Hội nhập tốt bắt buộc có subCriteria hợp lệ: ngoaiNgu, kyNang hoặc hoiNhap"
          });
          continue;
        }

        if (
          category === "hoiNhapTot" &&
          subCriteria === "kyNang" &&
          !kyNangEvidenceType
        ) {
          errors.push({
            row,
            reason:
              "Hoạt động Hội nhập tốt - Kỹ năng bắt buộc có Loại minh chứng kỹ năng hợp lệ."
          });
          continue;
        }

        if (
          category === "hoiNhapTot" &&
          subCriteria === "hoiNhap" &&
          !hoiNhapEvidenceType
        ) {
          errors.push({
            row,
            reason:
              "Hoạt động Hội nhập tốt - Hoạt động hội nhập bắt buộc có Loại minh chứng hội nhập hợp lệ."
          });
          continue;
        }

        const eligibleAwardLevels = inferEligibleAwardLevels({
          category,
          organizerLevel,
          subCriteria,
          academicEvidenceType,
          kyNangEvidenceType,
          hoiNhapEvidenceType,
          volunteerDays
        });

        if (!eligibleAwardLevels || eligibleAwardLevels.length === 0) {
          errors.push({
            row,
            reason:
              "Hoạt động này chưa đủ điều kiện để hệ thống công nhận cho cấp Trường, ĐHQG-HCM hoặc Thành phố theo cấu hình hiện tại."
          });
          continue;
        }

        const key = [
          organizerLevel,
          title,
          category,
          subCriteria,
          kyNangEvidenceType,
          hoiNhapEvidenceType,
          academicEvidenceType,
          date ? date.toISOString() : "",
          volunteerDays
        ].join("_");

        if (!activityMap[key]) {
          activityMap[key] = {
            title,
            category,
            organizerLevel,
            eligibleAwardLevels,
            awardLevel: eligibleAwardLevels[0] || "truong",
            subCriteria,
            academicEvidenceType,
            kyNangEvidenceType,
            hoiNhapEvidenceType,
            date,
            volunteerDays,
            isVolunteerAward,
            participants: []
          };
        }

        activityMap[key].participants.push({
          studentId,
          fullName,
          className,
          subCriteria,
          academicEvidenceType,
          kyNangEvidenceType,
          hoiNhapEvidenceType,
          volunteerDays,
          isVolunteerAward
        });
      }

      let createdActivities = 0;

      for (const key of Object.keys(activityMap)) {
        const item = activityMap[key];

        const activity = new Activity({
          title: item.title,
          category: item.category,
          organizerLevel: item.organizerLevel,
          eligibleAwardLevels: item.eligibleAwardLevels,
          awardLevel: item.awardLevel,
          subCriteria: item.subCriteria,
          academicEvidenceType: item.academicEvidenceType,
          date: item.date,
          participants: item.participants,
          volunteerDays: item.volunteerDays,
          isVolunteerAward: item.isVolunteerAward,
          kyNangEvidenceType: item.kyNangEvidenceType,
          hoiNhapEvidenceType: item.hoiNhapEvidenceType,
          uploadedBy: req.admin.username || "admin"
        });

        await activity.save();
        createdActivities += 1;

        (activity.participants || []).forEach((participant) => {
          if (participant.studentId) {
            affectedStudentIds.add(String(participant.studentId));
          }
        });

        for (const participant of item.participants) {
          const student = await Student.findOne({
            studentId: participant.studentId
          });

          if (!student) continue;

          if (item.eligibleAwardLevels.includes("truong")) {
            if (item.category === "hocTapTot") {
              await recomputeHocTapProgress(participant.studentId);
            } else if (item.category === "tinhNguyenTot") {
              await recomputeTinhNguyenProgress(participant.studentId);
            } else if (item.category === "hoiNhapTot") {
              await recomputeHoiNhapProgress(participant.studentId);
            } else {
              if (student.sv5tProgress?.[item.category]) {
                student.sv5tProgress[item.category].isCompleted = true;
                student.sv5tProgress[item.category].completedBy = "activity";
                student.sv5tProgress[item.category].completedAt = new Date();

                updateStudentProgressSummary(student);

                await student.save();
              }
            }
          }

          if (item.eligibleAwardLevels.includes("dhqg")) {
            await recomputeHigherLevelProgressForStudent(
              participant.studentId,
              "dhqg"
            );
          }

          if (item.eligibleAwardLevels.includes("thanh")) {
            await recomputeHigherLevelProgressForStudent(
              participant.studentId,
              "thanh"
            );
          }
        }
      }

      if (affectedStudentIds.size > 0) {
        await sendPushToStudents([...affectedStudentIds], {
          title: "Có hoạt động mới được ghi nhận",
          body: "Admin vừa cập nhật hoạt động mới vào hồ sơ Sinh viên 5 tốt của bạn.",
          url: "/student-dashboard.html"
        }).catch((error) => {
          console.error("Push uploaded activities error:", error.message);
        });
      }

      return res.json({
        success: true,
        message: "Upload danh sách hoạt động thành công",
        createdActivities,
        totalRows: rows.length,
        notifiedStudents: affectedStudentIds.size,
        errors
      });
    } catch (error) {
      console.error("Upload activities error:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi upload hoạt động"
      });
    } finally {
      cleanupTempFile(tempFilePath);
    }
  }
);

// ===============================
// PENDING EVIDENCE COUNT (for sidebar badge)
// ===============================

router.get("/evidences/pending-count", requireAdminAuth, async (req, res) => {
  try {
    let schoolPending = 0;

    if (req.admin.role === "admin") {
      const classStudents = await Student.find({ className: req.admin.className }).select("studentId").lean();
      const ids = classStudents.map((s) => s.studentId);
      schoolPending = await Evidence.countDocuments({
        studentId: { $in: ids },
        status: "pending",
        awardLevel: { $ne: "trung_uong" }
      });
    } else {
      schoolPending = await Evidence.countDocuments({
        status: "pending",
        awardLevel: { $ne: "trung_uong" }
      });
    }

    const centralPending = await Evidence.countDocuments({
      status: "pending",
      awardLevel: "trung_uong"
    });

    res.json({ success: true, schoolPending, centralPending });
  } catch (err) {
    console.error("Pending count error:", err);
    res.status(500).json({ success: false, schoolPending: 0, centralPending: 0 });
  }
});

// ===============================
// 7. ADMIN / SUPER ADMIN: XEM TOÀN BỘ MINH CHỨNG
// ===============================

router.get("/evidences/all", requireAdminAuth, async (req, res) => {
  try {
    const { status, className, category, awardLevel } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    if (awardLevel && VALID_AWARD_LEVELS.includes(awardLevel)) {
      query.awardLevel = awardLevel;
    }

    let evidences = await Evidence.find(query).sort({
      createdAt: -1
    });

    const studentIds = evidences.map((evidence) => evidence.studentId);

    const students = await Student.find({
      studentId: {
        $in: studentIds
      }
    }).select("studentId fullName className");

    const studentMap = {};

    students.forEach((student) => {
      studentMap[student.studentId] = student;
    });

    evidences = evidences
      .map((evidence) => {
        const student = studentMap[evidence.studentId];

        return {
          ...evidence.toObject(),
          student: student || null
        };
      })
      .filter((evidence) => {
        if (!evidence.student) return false;

        if (req.admin.role === "admin") {
          return evidence.student.className === req.admin.className;
        }

        if (className) {
          return evidence.student.className === className;
        }

        return true;
      });

    res.json({
      success: true,
      total: evidences.length,
      evidences
    });
  } catch (error) {
    console.error("Get all evidences error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy minh chứng"
    });
  }
});

// ===============================
// 8. ADMIN / SUPER ADMIN: DUYỆT / TỪ CHỐI MINH CHỨNG
// ===============================

router.patch(
  "/evidences/:evidenceId/review",
  requireAdminAuth,
  async (req, res) => {
    try {
      const { evidenceId } = req.params;
      const { status, note, reviewedBy, manualReview = {} } = req.body;

      const validStatuses = [
        "approved_by_admin",
        "rejected_by_admin",
        "need_more_info"
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            "Trạng thái duyệt không hợp lệ. Chỉ được dùng approved_by_admin, rejected_by_admin hoặc need_more_info"
        });
      }

      const evidence = await Evidence.findById(evidenceId);

      if (!evidence) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy minh chứng"
        });
      }

      const evidenceStudent = await Student.findOne({
        studentId: evidence.studentId
      }).select("studentId fullName className");

      if (!evidenceStudent) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy sinh viên của minh chứng này"
        });
      }

      if (
        req.admin.role === "admin" &&
        evidenceStudent.className !== req.admin.className
      ) {
        return res.status(403).json({
          success: false,
          message: "Bạn chỉ được duyệt minh chứng của sinh viên chi Hội mình"
        });
      }

      evidence.status = status;
      evidence.adminReview = {
        reviewedBy: reviewedBy || req.admin.username || "admin",
        reviewedAt: new Date(),
        note: note || ""
      };

      if (status === "approved_by_admin") {
        evidence.aiResult = evidence.aiResult || {};

        if (manualReview.subCriteria) {
          evidence.aiResult.subCriteria = manualReview.subCriteria;
        }

        if (manualReview.foreignLanguageEvidenceType) {
          evidence.aiResult.foreignLanguageEvidenceType =
            manualReview.foreignLanguageEvidenceType;
        }

        if (manualReview.kyNangEvidenceType) {
          evidence.aiResult.kyNangEvidenceType =
            manualReview.kyNangEvidenceType;
        }

        if (manualReview.hoiNhapEvidenceType) {
          evidence.aiResult.hoiNhapEvidenceType =
            manualReview.hoiNhapEvidenceType;
        }

        if (manualReview.academicEvidenceType) {
          evidence.aiResult.academicEvidenceType =
            manualReview.academicEvidenceType;
        }

        if (
          manualReview.volunteerDays !== undefined &&
          manualReview.volunteerDays !== null &&
          manualReview.volunteerDays !== ""
        ) {
          evidence.aiResult.volunteerDays =
            Number(manualReview.volunteerDays || 0);
        }

        evidence.aiResult.hasVolunteerAward =
          manualReview.hasVolunteerAward === true ||
          manualReview.hasVolunteerAward === "true" ||
          evidence.aiResult.hasVolunteerAward === true;

        evidence.aiResult.manualOverrideByAdmin = true;
        evidence.aiResult.isValid = true;

        evidence.markModified("aiResult");
      }

      await evidence.save();

      if (status === "approved_by_admin") {
        await archiveEvidenceToR2FromAdmin(evidence);

        await recomputeSchoolProgressAfterEvidence(evidence);
        await recomputeHigherLevelProgressAfterEvidence(evidence);
        await recomputeCentralProgressAfterEvidence(evidence);
      }

      if (status === "rejected_by_admin") {
        await deleteTempEvidenceFileFromAdmin(evidence);
      }

      if (status === "approved_by_admin") {
        await sendPushToStudent(evidence.studentId, {
          title: "Minh chứng đã được duyệt",
          body: `Minh chứng ${evidence.fileName} của bạn đã được admin duyệt.`,
          url: "/student-dashboard.html"
        }).catch((error) => {
          console.error("Push approved evidence error:", error.message);
        });
      }

      if (status === "rejected_by_admin") {
        await sendPushToStudent(evidence.studentId, {
          title: "Minh chứng chưa được duyệt",
          body: `Minh chứng ${evidence.fileName} của bạn chưa được duyệt. Vui lòng kiểm tra lại.`,
          url: "/student-dashboard.html"
        }).catch((error) => {
          console.error("Push rejected evidence error:", error.message);
        });
      }

      if (status === "need_more_info") {
        await sendPushToStudent(evidence.studentId, {
          title: "Cần bổ sung minh chứng",
          body: `Minh chứng ${evidence.fileName} cần bổ sung thông tin.`,
          url: "/student-dashboard.html"
        }).catch((error) => {
          console.error("Push need more info error:", error.message);
        });
      }

      if (status === "rejected_by_admin") {
        return res.json({
          success: true,
          message:
            "Đã từ chối minh chứng. File tạm đã được xóa và không lưu vào Cloudflare R2.",
          evidence
        });
      }

      if (status === "need_more_info") {
        return res.json({
          success: true,
          message: "Đã yêu cầu sinh viên bổ sung thông tin minh chứng.",
          evidence
        });
      }

      return res.json({
        success: true,
        message:
          evidence.awardLevel === "truong"
            ? "Đã duyệt minh chứng hợp lệ. File đã được lưu vào Cloudflare R2 và cập nhật tiến độ cấp Trường."
            : "Đã duyệt minh chứng hợp lệ. File đã được lưu vào Cloudflare R2. Tiến độ cấp cao hơn sẽ được tính tự động khi sinh viên tải lại trang xét cấp tương ứng.",
        evidence
      });
    } catch (error) {
      console.error("Review evidence error:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi duyệt minh chứng"
      });
    }
  }
);

// ===============================
// 9. ADMIN / SUPER ADMIN: XEM HOẠT ĐỘNG ĐÃ UPLOAD
// ===============================

router.get("/activities/uploaded", requireAdminAuth, async (req, res) => {
  try {
    const { organizerLevel } = req.query;

    const query = {};

    const validOrganizerLevels = [
      "chi_hoi",
      "khoa",
      "truong",
      "dhqg",
      "thanh",
      "quoc_gia",
      "quoc_te",
      "khac"
    ];

    if (organizerLevel && validOrganizerLevels.includes(organizerLevel)) {
      query.organizerLevel = organizerLevel;
    }

    const activities = await Activity.find(query)
      .sort({
        createdAt: -1
      })
      .lean();

    let filteredActivities = activities;

    if (req.admin.role === "admin") {
      filteredActivities = activities
        .map((activity) => {
          const participants = (activity.participants || []).filter(
            (participant) => participant.className === req.admin.className
          );

          return {
            ...activity,
            participants
          };
        })
        .filter((activity) => activity.participants.length > 0);
    }

    res.json({
      success: true,
      total: filteredActivities.length,
      activities: filteredActivities
    });
  } catch (error) {
    console.error("Get uploaded activities error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách hoạt động đã upload"
    });
  }
});

// ===============================
// ===============================
// 10b. ADMIN / SUPER ADMIN: XUẤT EXCEL HOẠT ĐỘNG ĐÃ UPLOAD
// ===============================

router.get("/activities/export", requireAdminAuth, async (req, res) => {
  try {
    const { activityId } = req.query;
    const query = {};
    if (activityId) {
      query._id = activityId;
    }
    if (req.admin.role === "admin") {
      query["participants.className"] = req.admin.className;
    }

    const activities = await Activity.find(query).sort({ createdAt: -1 }).lean();

    const rows = [];
    for (const act of activities) {
      const participants = req.admin.role === "admin"
        ? (act.participants || []).filter(p => p.className === req.admin.className)
        : (act.participants || []);

      for (const p of participants) {
        rows.push({
          title: act.title || "",
          category: act.category || "",
          organizerLevel: act.organizerLevel || "",
          subCriteria: act.subCriteria || "",
          academicEvidenceType: act.academicEvidenceType || "",
          kyNangEvidenceType: act.kyNangEvidenceType || "",
          hoiNhapEvidenceType: act.hoiNhapEvidenceType || "",
          volunteerDays: act.volunteerDays ?? "",
          date: act.date ? new Date(act.date).toLocaleDateString("vi-VN") : "",
          studentId: p.studentId || "",
          fullName: p.fullName || "",
          className: p.className || "",
          uploadedBy: act.uploadedBy || ""
        });
      }
    }

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(rows, {
      header: [
        "title", "category", "organizerLevel", "subCriteria",
        "academicEvidenceType", "kyNangEvidenceType", "hoiNhapEvidenceType",
        "volunteerDays", "date", "studentId", "fullName", "className", "uploadedBy"
      ]
    });
    xlsx.utils.book_append_sheet(wb, ws, "HoatDong");

    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = activityId && activities[0]?.title
      ? `${activities[0].title.replace(/[^a-zA-Z0-9À-ɏḀ-ỿ ]/g, "_")}.xlsx`
      : "hoat-dong.xlsx";
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error) {
    console.error("Export activities error:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi xuất Excel." });
  }
});

// ===============================
// 10b. ADMIN / SUPER ADMIN: SỬA HOẠT ĐỘNG ĐÃ UPLOAD
// ===============================

router.patch("/activities/:activityId", requireAdminAuth, async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await Activity.findById(activityId);

    if (!activity) {
      return res.status(404).json({ success: false, message: "Không tìm thấy hoạt động." });
    }

    if (req.admin.role === "admin") {
      const hasClassParticipant = (activity.participants || []).some(
        (p) => p.className === req.admin.className
      );
      if (!hasClassParticipant) {
        return res.status(403).json({ success: false, message: "Bạn không có quyền sửa hoạt động này." });
      }
    }

    const {
      title,
      category,
      organizerLevel,
      date,
      subCriteria,
      academicEvidenceType,
      volunteerDays,
      kyNangEvidenceType,
      hoiNhapEvidenceType
    } = req.body;

    const oldCategory = activity.category;
    const oldEligible = [...(activity.eligibleAwardLevels || [])];

    if (title !== undefined)               activity.title               = String(title).trim();
    if (category !== undefined)            activity.category            = category;
    if (organizerLevel !== undefined)      activity.organizerLevel      = organizerLevel;
    if (date !== undefined)                activity.date                = new Date(date);
    if (subCriteria !== undefined)         activity.subCriteria         = String(subCriteria || "").trim();
    if (academicEvidenceType !== undefined) activity.academicEvidenceType = String(academicEvidenceType || "").trim();
    if (volunteerDays !== undefined)       activity.volunteerDays       = Number(volunteerDays) || 0;
    if (kyNangEvidenceType !== undefined)  activity.kyNangEvidenceType  = String(kyNangEvidenceType || "").trim();
    if (hoiNhapEvidenceType !== undefined) activity.hoiNhapEvidenceType = String(hoiNhapEvidenceType || "").trim();

    const newEligible = inferEligibleAwardLevels({
      category:              activity.category,
      organizerLevel:        activity.organizerLevel,
      subCriteria:           activity.subCriteria,
      academicEvidenceType:  activity.academicEvidenceType,
      kyNangEvidenceType:    activity.kyNangEvidenceType,
      hoiNhapEvidenceType:   activity.hoiNhapEvidenceType,
      volunteerDays:         activity.volunteerDays
    });

    activity.eligibleAwardLevels = newEligible || [];
    activity.awardLevel = (newEligible && newEligible[0]) || "truong";

    await activity.save();

    // Recompute tiến độ cho các sinh viên tham gia
    const affectedStudentIds = [
      ...new Set((activity.participants || []).map((p) => p.studentId).filter(Boolean))
    ];

    const allCategories = [...new Set([oldCategory, activity.category].filter(Boolean))];

    for (const studentId of affectedStudentIds) {
      for (const cat of allCategories) {
        if (cat === "hocTapTot") {
          await recomputeHocTapProgress(studentId);
        } else if (cat === "tinhNguyenTot") {
          await recomputeTinhNguyenProgress(studentId);
        } else if (cat === "hoiNhapTot") {
          await recomputeHoiNhapProgress(studentId);
        }
      }
    }

    res.json({
      success: true,
      message: "Đã cập nhật hoạt động.",
      eligibleAwardLevels: activity.eligibleAwardLevels
    });
  } catch (error) {
    console.error("Edit activity error:", error);
    res.status(500).json({ success: false, message: "Lỗi server khi sửa hoạt động." });
  }
});

// ===============================
// 10. ADMIN / SUPER ADMIN: XÓA HOẠT ĐỘNG ĐÃ UPLOAD
// ===============================

router.delete("/activities/:activityId", requireAdminAuth, async (req, res) => {
  try {
    const { activityId } = req.params;

    const activity = await Activity.findById(activityId);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hoạt động"
      });
    }

    if (req.admin.role === "admin") {
      const hasClassParticipant = (activity.participants || []).some(
        (participant) => participant.className === req.admin.className
      );

      if (!hasClassParticipant) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xóa hoạt động này"
        });
      }
    }

    const affectedStudentIds = [
      ...new Set(
        (activity.participants || [])
          .map((participant) => participant.studentId)
          .filter(Boolean)
      )
    ];

    const category = activity.category;

    const eligibleAwardLevels = Array.isArray(activity.eligibleAwardLevels)
      ? activity.eligibleAwardLevels
      : [];

    await Activity.findByIdAndDelete(activityId);

    for (const studentId of affectedStudentIds) {
      if (eligibleAwardLevels.includes("truong")) {
        if (category === "hocTapTot") {
          await recomputeHocTapProgress(studentId);
        } else if (category === "tinhNguyenTot") {
          await recomputeTinhNguyenProgress(studentId);
        } else if (category === "hoiNhapTot") {
          await recomputeHoiNhapProgress(studentId);
        } else {
          const student = await Student.findOne({ studentId });

          if (student && student.sv5tProgress?.[category]) {
            const remainingActivity = await Activity.findOne({
              category,
              "participants.studentId": studentId,
              $or: [
                {
                  eligibleAwardLevels: "truong"
                },
                {
                  eligibleAwardLevels: {
                    $exists: false
                  },
                  awardLevel: "truong"
                }
              ]
            });

            const remainingEvidence = await Evidence.findOne({
              studentId,
              category,
              awardLevel: "truong",
              status: {
                $in: ["ai_valid", "approved_by_admin"]
              }
            });

            if (!remainingActivity && !remainingEvidence) {
              student.sv5tProgress[category].isCompleted = false;
              student.sv5tProgress[category].completedBy = "none";
              student.sv5tProgress[category].completedAt = null;
            }

            updateStudentProgressSummary(student);
            await student.save();
          }
        }
      }

      if (eligibleAwardLevels.includes("dhqg")) {
        await recomputeHigherLevelProgressForStudent(studentId, "dhqg");
      }

      if (eligibleAwardLevels.includes("thanh")) {
        await recomputeHigherLevelProgressForStudent(studentId, "thanh");
      }
    }

    const updatedLevels = [];

    if (eligibleAwardLevels.includes("truong")) {
      updatedLevels.push("cấp Trường");
    }

    if (eligibleAwardLevels.includes("dhqg")) {
      updatedLevels.push("cấp ĐHQG-HCM");
    }

    if (eligibleAwardLevels.includes("thanh")) {
      updatedLevels.push("cấp Thành phố");
    }

    return res.json({
      success: true,
      message:
        updatedLevels.length > 0
          ? `Xóa hoạt động thành công và đã cập nhật lại tiến độ ${updatedLevels.join(", ")}.`
          : "Xóa hoạt động thành công. Hoạt động này không được tính cho cấp xét nào nên không cập nhật tiến độ."
    });
  } catch (error) {
    console.error("Delete uploaded activity error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa hoạt động"
    });
  }
});

// ===============================
// 11. ADMIN: TẠO MÃ RESET MẬT KHẨU CHO SINH VIÊN
// ===============================

router.post(
  "/students/:studentId/generate-reset-code",
  requireAdminAuth,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const student = await Student.findOne({
        studentId
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy sinh viên"
        });
      }

      if (
        req.admin.role === "admin" &&
        student.className !== req.admin.className
      ) {
        return res.status(403).json({
          success: false,
          message: `Admin chi Hội ${req.admin.className} không được tạo mã reset cho sinh viên chi Hội ${student.className}`
        });
      }

      const resetCode = generateResetCode();

      student.resetPasswordCodeHash = hashResetCode(resetCode);
      student.resetPasswordExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      student.resetPasswordUsed = false;

      await student.save();

      return res.json({
        success: true,
        message: "Tạo mã reset thành công. Mã có hiệu lực trong 10 phút.",
        resetCode,
        expiresInMinutes: 10,
        student: {
          studentId: student.studentId,
          fullName: student.fullName,
          className: student.className
        }
      });
    } catch (error) {
      console.error("Generate reset code error:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi tạo mã reset"
      });
    }
  }
);

// ===============================
// 12. ADMIN: XEM THÔNG TIN HỖ TRỢ CỦA chi Hội
// ===============================

router.get("/class-support/:className", requireAdminAuth, async (req, res) => {
  try {
    const className = String(req.params.className || "").trim();

    if (
      req.admin.role === "admin" &&
      className !== req.admin.className
    ) {
      return res.status(403).json({
        success: false,
        message: "Admin chi Hội chỉ được xem thông tin hỗ trợ của chi Hội mình"
      });
    }

    const classSupport = await ClassSupport.findOne({
      className
    });

    return res.json({
      success: true,
      classSupport
    });
  } catch (error) {
    console.error("Get class support error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thông tin hỗ trợ chi Hội"
    });
  }
});

// ===============================
// 13. ADMIN: CẬP NHẬT THÔNG TIN HỖ TRỢ CỦA chi Hội
// ===============================

router.put("/class-support/:className", requireAdminAuth, async (req, res) => {
  try {
    const className = String(req.params.className || "").trim();

    if (
      req.admin.role === "admin" &&
      className !== req.admin.className
    ) {
      return res.status(403).json({
        success: false,
        message: "Admin chi Hội chỉ được cập nhật thông tin hỗ trợ của chi Hội mình"
      });
    }

    const {
      chiHoiTruong,
      chiHoiPho,
      uyVienBCHList,
      ctvBCH
    } = req.body;

    const cleanUyVienBCHList = Array.isArray(uyVienBCHList)
      ? uyVienBCHList
          .map((person) => ({
            fullName: String(person?.fullName || "").trim(),
            phone: String(person?.phone || "").trim(),
            zalo: String(person?.zalo || "").trim()
          }))
          .filter((person) => {
            return person.fullName || person.phone || person.zalo;
          })
      : [];

    if (cleanUyVienBCHList.length < 2 || cleanUyVienBCHList.length > 3) {
      return res.status(400).json({
        success: false,
        message: "Mỗi chi Hội cần có từ 2 đến 3 Ủy viên BCH"
      });
    }

    const classSupport = await ClassSupport.findOneAndUpdate(
      {
        className
      },
      {
        className,
        chiHoiTruong: {
          fullName: String(chiHoiTruong?.fullName || "").trim(),
          phone: String(chiHoiTruong?.phone || "").trim(),
          zalo: String(chiHoiTruong?.zalo || "").trim()
        },
        chiHoiPho: {
          fullName: String(chiHoiPho?.fullName || "").trim(),
          phone: String(chiHoiPho?.phone || "").trim(),
          zalo: String(chiHoiPho?.zalo || "").trim()
        },
        uyVienBCHList: cleanUyVienBCHList,
        ctvBCH: {
          fullName: String(ctvBCH?.fullName || "").trim(),
          phone: String(ctvBCH?.phone || "").trim(),
          zalo: String(ctvBCH?.zalo || "").trim()
        },
        updatedBy: req.admin.username || req.admin.email || "admin"
      },
      {
        returnDocument: 'after',
        upsert: true,
        runValidators: true
      }
    );

    return res.json({
      success: true,
      message: "Cập nhật thông tin hỗ trợ chi Hội thành công",
      classSupport
    });
  } catch (error) {
    console.error("Update class support error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật thông tin hỗ trợ chi Hội"
    });
  }
});

// ===============================
// 14. ADMIN: UPLOAD DANH SÁCH HỖ TRỢ CỦA chi Hội BẰNG EXCEL
// ===============================

router.post(
  "/upload-class-support",
  requireAdminAuth,
  upload.single("file"),
  async (req, res) => {
    const tempFilePath = req.file?.path;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng upload file Excel"
        });
      }

      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      const errors = [];
      let updatedCount = 0;

      for (const row of rows) {
        const className = String(row.className || "").trim();

        if (!className) {
          errors.push({
            row,
            reason: "Thiếu className"
          });
          continue;
        }

        if (req.admin.role === "admin" && className !== req.admin.className) {
          errors.push({
            row,
            reason: `Admin chi Hội ${req.admin.className} không được upload thông tin chi Hội ${className}`
          });
          continue;
        }

        const chiHoiTruong = {
          fullName: String(row.chiHoiTruongName || "").trim(),
          phone: String(row.chiHoiTruongPhone || "").trim(),
          zalo: String(row.chiHoiTruongZalo || "").trim()
        };

        if (!chiHoiTruong.fullName) {
          errors.push({
            row,
            reason: "Thiếu chiHoiTruongName"
          });
          continue;
        }

        const chiHoiPho = {
          fullName: String(row.chiHoiPhoName || "").trim(),
          phone: String(row.chiHoiPhoPhone || "").trim(),
          zalo: String(row.chiHoiPhoZalo || "").trim()
        };

        const uyVienBCHList = [];

        const uyVienBCH1 = {
          fullName: String(row.uyVienBCH1Name || "").trim(),
          phone: String(row.uyVienBCH1Phone || "").trim(),
          zalo: String(row.uyVienBCH1Zalo || "").trim()
        };

        const uyVienBCH2 = {
          fullName: String(row.uyVienBCH2Name || "").trim(),
          phone: String(row.uyVienBCH2Phone || "").trim(),
          zalo: String(row.uyVienBCH2Zalo || "").trim()
        };

        const uyVienBCH3 = {
          fullName: String(row.uyVienBCH3Name || "").trim(),
          phone: String(row.uyVienBCH3Phone || "").trim(),
          zalo: String(row.uyVienBCH3Zalo || "").trim()
        };

        [uyVienBCH1, uyVienBCH2, uyVienBCH3].forEach((person) => {
          if (person.fullName || person.phone || person.zalo) {
            uyVienBCHList.push(person);
          }
        });

        if (uyVienBCHList.length < 2 || uyVienBCHList.length > 3) {
          errors.push({
            row,
            reason: "Mỗi chi Hội cần có từ 2 đến 3 Ủy viên BCH"
          });
          continue;
        }

        const ctvBCH = {
          fullName: String(row.ctvBCHName || "").trim(),
          phone: String(row.ctvBCHPhone || "").trim(),
          zalo: String(row.ctvBCHZalo || "").trim()
        };

        await ClassSupport.findOneAndUpdate(
          {
            className
          },
          {
            className,
            chiHoiTruong,
            chiHoiPho,
            uyVienBCHList,
            ctvBCH,
            updatedBy: req.admin.username || req.admin.email || "admin"
          },
          {
            upsert: true,
            returnDocument: 'after',
            runValidators: true
          }
        );

        updatedCount += 1;
      }

      return res.json({
        success: errors.length === 0,
        message:
          errors.length === 0
            ? "Upload thông tin hỗ trợ chi Hội thành công"
            : "Upload hoàn tất nhưng có một số dòng lỗi",
        updatedCount,
        totalRows: rows.length,
        errors
      });
    } catch (error) {
      console.error("Upload class support error:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi upload thông tin hỗ trợ chi Hội"
      });
    } finally {
      cleanupTempFile(tempFilePath);
    }
  }
);

router.get(
  "/central-prerequisites/:studentId",
  requireAdminAuth,
  async (req, res) => {
    try {
      const studentId = String(req.params.studentId || "").trim();

      const student = await Student.findOne({ studentId }).select(
        "studentId fullName className centralPrerequisites"
      );

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy sinh viên"
        });
      }

      if (
        req.admin.role === "admin" &&
        student.className !== req.admin.className
      ) {
        return res.status(403).json({
          success: false,
          message: "Admin chi Hội chỉ được xem sinh viên thuộc chi Hội mình"
        });
      }

      return res.json({
        success: true,
        student: {
          studentId: student.studentId,
          fullName: student.fullName,
          className: student.className
        },
        centralPrerequisites: student.centralPrerequisites || {
          hasProvincialAward: {
            isApproved: false,
            approvedBy: "",
            approvedAt: null,
            note: ""
          },
          hasProvincialRecommendation: {
            isApproved: false,
            approvedBy: "",
            approvedAt: null,
            note: ""
          }
        }
      });
    } catch (error) {
      console.error("Get central prerequisites error:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi lấy điều kiện cấp Trung ương"
      });
    }
  }
);

router.put(
  "/central-prerequisites/:studentId",
  requireAdminAuth,
  async (req, res) => {
    try {
      const studentId = String(req.params.studentId || "").trim();

      const {
        hasProvincialRecommendation
      } = req.body;

      const student = await Student.findOne({ studentId });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy sinh viên"
        });
      }

      if (
        req.admin.role === "admin" &&
        student.className !== req.admin.className
      ) {
        return res.status(403).json({
          success: false,
          message: "Admin chi Hội chỉ được cập nhật sinh viên thuộc chi Hội mình"
        });
      }

      const adminName =
        req.admin.username ||
        req.admin.email ||
        req.admin.fullName ||
        "admin";

      if (!student.centralPrerequisites) {
        student.centralPrerequisites = {};
      }

      if (hasProvincialRecommendation) {
        student.centralPrerequisites.hasProvincialRecommendation = {
          isApproved: hasProvincialRecommendation.isApproved === true,
          approvedBy:
            hasProvincialRecommendation.isApproved === true ? adminName : "",
          approvedAt:
            hasProvincialRecommendation.isApproved === true ? new Date() : null,
          note: String(hasProvincialRecommendation.note || "").trim()
        };
      }

      await student.save();

      const updatedPrerequisites = student.centralPrerequisites;

      const canProceedToCentral =
        updatedPrerequisites?.hasProvincialAward?.isApproved === true &&
        updatedPrerequisites?.hasProvincialRecommendation?.isApproved === true;

      const plainPrerequisites =
        typeof updatedPrerequisites?.toObject === "function"
          ? updatedPrerequisites.toObject()
          : updatedPrerequisites;

      return res.json({
        success: true,
        message: "Cập nhật điều kiện đầu vào cấp Trung ương thành công",
        centralPrerequisites: {
          ...plainPrerequisites,
          canProceedToCentral
        }
      });
    } catch (error) {
      console.error("Update central prerequisites error:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi cập nhật điều kiện cấp Trung ương"
      });
    }
  }
);

// PATCH /api/admin/central-evidence/:evidenceId/review
router.patch(
  "/central-evidence/:evidenceId/review",
  requireAdminAuth,
  async (req, res) => {
    try {
      const { evidenceId } = req.params;
      const { action, note } = req.body;

      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({
          success: false,
          message: "Hành động không hợp lệ."
        });
      }

      const evidence = await Evidence.findById(evidenceId);

      if (!evidence) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy minh chứng."
        });
      }

      if (evidence.awardLevel !== "trung_uong") {
        return res.status(400).json({
          success: false,
          message: "Minh chứng này không thuộc cấp Trung ương."
        });
      }

      evidence.status =
  action === "approve" ? "approved_by_admin" : "rejected_by_admin";
      evidence.adminReview = {
        reviewedBy: req.admin?.username || req.admin?.email || "admin",
        reviewedAt: new Date(),
        note: note || ""
      };

      await evidence.save();
      await recomputeCentralProgressAfterEvidence(evidence);

      return res.json({
        success: true,
        message:
          action === "approve"
            ? "Đã duyệt minh chứng cấp Trung ương."
            : "Đã từ chối minh chứng cấp Trung ương.",
        evidence
      });
    } catch (error) {
      console.error("Review central evidence error:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi duyệt minh chứng cấp Trung ương."
      });
    }
  }
);

// GET /api/admin/central-evidences
router.get("/central-evidences", requireAdminAuth, async (req, res) => {
  try {
    const evidences = await Evidence.find({
      awardLevel: "trung_uong"
    })
      .sort({
        createdAt: -1
      })
      .lean();

    const studentIds = evidences.map((evidence) => {
      return evidence.studentId;
    });

    const students = await Student.find({
      studentId: {
        $in: studentIds
      }
    })
      .select("studentId fullName className")
      .lean();

    const studentMap = {};

    students.forEach((student) => {
      studentMap[student.studentId] = student;
    });

    const evidencesWithStudents = evidences.map((evidence) => {
      const student = studentMap[evidence.studentId] || {};

      return {
        ...evidence,
        student: {
          studentId: student.studentId || evidence.studentId || "",
          fullName: student.fullName || "Chưa cập nhật",
          className: student.className || "Chưa cập nhật"
        },
        studentName: student.fullName || "Chưa cập nhật",
        fullName: student.fullName || "Chưa cập nhật"
      };
    });

    return res.json({
      success: true,
      evidences: evidencesWithStudents
    });
  } catch (error) {
    console.error("Get central evidences error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách minh chứng cấp Trung ương."
    });
  }
});

// ===============================
// SUPER ADMIN: XEM THÔNG TIN BAN CHỈ HỘI TẤT CẢ chi Hội
// ===============================

router.get(
  "/all-class-support",
  requireAdminAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const list = await ClassSupport.find()
        .select("-__v")
        .sort({ className: 1 })
        .lean();

      return res.json({ success: true, list });
    } catch (error) {
      console.error("Get all class support error:", error);
      return res.status(500).json({ success: false, message: "Lỗi server." });
    }
  }
);

// ===============================
// SUPER ADMIN: TẠO MÃ RESET MẬT KHẨU CHO ADMIN
// ===============================

router.post(
  "/admins/:username/generate-reset-code",
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { username } = req.params;

      const admin = await Admin.findOne({ username: username.trim() });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy tài khoản admin"
        });
      }

      const resetCode = generateResetCode();

      admin.resetPasswordCodeHash = hashResetCode(resetCode);
      admin.resetPasswordExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      admin.resetPasswordUsed = false;

      await admin.save();

      return res.json({
        success: true,
        message: "Tạo mã reset thành công. Mã có hiệu lực trong 10 phút.",
        resetCode,
        expiresInMinutes: 10,
        admin: {
          username: admin.username,
          role: admin.role,
          className: admin.className || ""
        }
      });
    } catch (error) {
      console.error("Generate admin reset code error:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi server khi tạo mã reset"
      });
    }
  }
);

// ===============================
// ADMIN / SUPER ADMIN: XÓA SINH VIÊN
// ===============================

router.delete(
  "/students/:studentId",
  requireAdminAuth,
  async (req, res) => {
    try {
      const { studentId } = req.params;

      const student = await Student.findOne({ studentId });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy sinh viên"
        });
      }

      if (req.admin.role === "admin" && req.admin.className !== student.className) {
        return res.status(403).json({
          success: false,
          message: "Bạn chỉ được xóa sinh viên thuộc chi Hội mình quản lý"
        });
      }

      await Evidence.deleteMany({ studentId });
      await Student.deleteOne({ studentId });

      res.json({
        success: true,
        message: `Đã xóa sinh viên ${studentId} và toàn bộ minh chứng liên quan`
      });
    } catch (error) {
      console.error("Delete student error:", error);

      res.status(500).json({
        success: false,
        message: "Lỗi server khi xóa sinh viên"
      });
    }
  }
);

// ===============================
// SUPER ADMIN: ĐẾM SINH VIÊN THEO chi Hội
// ===============================

router.get(
  "/classes/student-count",
  requireAdminAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const counts = await Student.aggregate([
        { $group: { _id: "$className", total: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);

      res.json({
        success: true,
        counts: counts.map((item) => ({
          className: item._id,
          total: item.total
        }))
      });
    } catch (error) {
      console.error("Student count by class error:", error);

      res.status(500).json({
        success: false,
        message: "Lỗi server khi đếm sinh viên"
      });
    }
  }
);

// ===============================
// OVERVIEW STATS — trả về breakdown trạng thái + tiêu chí cho 1 chi Hội
// ===============================
router.get(
  "/class/:className/overview-stats",
  requireAdminAuth,
  async (req, res) => {
    try {
      const { className } = req.params;

      if (req.admin.role === "admin" && req.admin.className !== className) {
        return res.status(403).json({
          success: false,
          message: "Bạn chỉ được xem thống kê chi Hội mình."
        });
      }

      const students = await Student.find({ className }).select(
        "sv5tStatus sv5tProgress isActivated totalCompletedCriteria"
      );

      const statusBreakdown = {
        not_started: 0,
        in_progress: 0,
        completed: 0,
        submitted: 0,
        approved: 0,
        rejected: 0
      };

      const criteriaBreakdown = {
        daoDucTot: 0,
        hocTapTot: 0,
        theLucTot: 0,
        tinhNguyenTot: 0,
        hoiNhapTot: 0
      };

      let activatedCount = 0;

      students.forEach((s) => {
        if (statusBreakdown[s.sv5tStatus] !== undefined) {
          statusBreakdown[s.sv5tStatus]++;
        }
        if (s.isActivated) activatedCount++;
        Object.keys(criteriaBreakdown).forEach((key) => {
          if (s.sv5tProgress?.[key]?.isCompleted) criteriaBreakdown[key]++;
        });
      });

      res.json({
        success: true,
        totalStudents: students.length,
        activatedStudents: activatedCount,
        statusBreakdown,
        criteriaBreakdown
      });
    } catch (error) {
      console.error("Overview stats error:", error);
      res.status(500).json({ success: false, message: "Lỗi server" });
    }
  }
);

// ===============================
// OVERVIEW STATS toàn khoa — chỉ super_admin
// ===============================
router.get(
  "/all-students/status-stats",
  requireAdminAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const students = await Student.find().select(
        "sv5tStatus sv5tProgress isActivated"
      );

      const statusBreakdown = {
        not_started: 0,
        in_progress: 0,
        completed: 0,
        submitted: 0,
        approved: 0,
        rejected: 0
      };

      const criteriaBreakdown = {
        daoDucTot: 0,
        hocTapTot: 0,
        theLucTot: 0,
        tinhNguyenTot: 0,
        hoiNhapTot: 0
      };

      let activatedCount = 0;

      students.forEach((s) => {
        if (statusBreakdown[s.sv5tStatus] !== undefined) {
          statusBreakdown[s.sv5tStatus]++;
        }
        if (s.isActivated) activatedCount++;
        Object.keys(criteriaBreakdown).forEach((key) => {
          if (s.sv5tProgress?.[key]?.isCompleted) criteriaBreakdown[key]++;
        });
      });

      res.json({
        success: true,
        totalStudents: students.length,
        activatedStudents: activatedCount,
        statusBreakdown,
        criteriaBreakdown
      });
    } catch (error) {
      console.error("All students status stats error:", error);
      res.status(500).json({ success: false, message: "Lỗi server" });
    }
  }
);

// ===============================
// FIX ACTIVATED STATUS — cập nhật sinh viên đã kích hoạt nhưng vẫn not_started
// ===============================
router.patch(
  "/fix-activated-status",
  requireAdminAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const result = await Student.updateMany(
        { isActivated: true, sv5tStatus: "not_started" },
        { $set: { sv5tStatus: "in_progress" } }
      );

      res.json({
        success: true,
        updatedCount: result.modifiedCount,
        message: `Đã cập nhật ${result.modifiedCount} sinh viên sang "Đang thực hiện".`
      });
    } catch (error) {
      console.error("Fix activated status error:", error);
      res.status(500).json({ success: false, message: "Lỗi server khi cập nhật trạng thái" });
    }
  }
);

// ===============================
// MAINTENANCE MODE
// ===============================
router.get(
  "/maintenance-mode",
  requireAdminAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const doc = await SystemSettings.findOne({ key: "maintenanceMode" }).lean();
      res.json({ success: true, enabled: doc?.value === true });
    } catch (error) {
      console.error("Get maintenance mode error:", error);
      res.status(500).json({ success: false, message: "Lỗi server." });
    }
  }
);

router.patch(
  "/maintenance-mode",
  requireAdminAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { enabled, securityCode } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ success: false, message: "enabled phải là boolean." });
      }
      const MAINTENANCE_CODE = process.env.MAINTENANCE_CODE || "19062006";
      if (String(securityCode || "").trim() !== MAINTENANCE_CODE) {
        return res.status(403).json({ success: false, message: "Mã bảo mật không đúng." });
      }
      await SystemSettings.findOneAndUpdate(
        { key: "maintenanceMode" },
        { value: enabled, updatedBy: req.admin.username, updatedAt: new Date() },
        { upsert: true, returnDocument: "after" }
      );
      invalidateMaintenanceCache();
      res.json({
        success: true,
        enabled,
        message: enabled
          ? "Đã bật chế độ bảo trì."
          : "Đã tắt chế độ bảo trì."
      });
    } catch (error) {
      console.error("Patch maintenance mode error:", error);
      res.status(500).json({ success: false, message: "Lỗi server." });
    }
  }
);

// ===============================
// BROADCAST PUSH NOTIFICATION
// ===============================
router.post(
  "/broadcast-push",
  requireAdminAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { title, body, url, target } = req.body;
      if (!title || !body) {
        return res.status(400).json({ success: false, message: "Tiêu đề và nội dung không được để trống." });
      }
      const validTargets = ["students", "admins", "all"];
      const resolvedTarget = validTargets.includes(target) ? target : "students";

      const count = await sendPushBroadcast(resolvedTarget, {
        title: String(title).trim(),
        body: String(body).trim(),
        url: url ? String(url).trim() : "/student-dashboard.html"
      });

      res.json({
        success: true,
        message: `Đã gửi thông báo tới ${count} thiết bị.`,
        count
      });
    } catch (error) {
      console.error("Broadcast push error:", error);
      res.status(500).json({ success: false, message: "Lỗi server khi gửi thông báo." });
    }
  }
);

// ===============================
// CHECK-IN HOẠT ĐỘNG
// ===============================

router.post(
  "/checkin/sessions",
  requireAdminAuth,
  async (req, res) => {
    try {
      const { title, description } = req.body;

      if (!title?.trim()) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập tên phiên check-in" });
      }

      let securityCode;
      let attempts = 0;
      while (attempts < 10) {
        securityCode = generateSecurityCode();
        const exists = await CheckinSession.exists({ securityCode });
        if (!exists) break;
        attempts++;
      }

      const session = new CheckinSession({
        title: title.trim(),
        description: description?.trim() || "",
        securityCode,
        createdBy: req.admin.username
      });

      await session.save();

      return res.json({ success: true, session });
    } catch (error) {
      console.error("Create checkin session error:", error);
      return res.status(500).json({ success: false, message: "Lỗi server khi tạo phiên check-in" });
    }
  }
);

router.get(
  "/checkin/sessions",
  requireAdminAuth,
  async (req, res) => {
    try {
      const sessions = await CheckinSession.find({})
        .sort({ createdAt: -1 })
        .select("-checkins")
        .lean();

      return res.json({ success: true, sessions });
    } catch (error) {
      console.error("List checkin sessions error:", error);
      return res.status(500).json({ success: false, message: "Lỗi server" });
    }
  }
);

router.get(
  "/checkin/sessions/:id",
  requireAdminAuth,
  async (req, res) => {
    try {
      const session = await CheckinSession.findById(req.params.id).lean();

      if (!session) {
        return res.status(404).json({ success: false, message: "Không tìm thấy phiên check-in" });
      }

      return res.json({ success: true, session });
    } catch (error) {
      console.error("Get checkin session error:", error);
      return res.status(500).json({ success: false, message: "Lỗi server" });
    }
  }
);

router.post(
  "/checkin/sessions/:id/scan",
  requireAdminAuth,
  async (req, res) => {
    try {
      const { studentId } = req.body;

      if (!studentId?.trim()) {
        return res.status(400).json({ success: false, message: "Thiếu MSSV" });
      }

      const session = await CheckinSession.findById(req.params.id);

      if (!session) {
        return res.status(404).json({ success: false, message: "Không tìm thấy phiên check-in" });
      }

      const alreadyIn = session.checkins.some((c) => c.studentId === studentId.trim());
      if (alreadyIn) {
        return res.status(409).json({
          success: false,
          message: `Sinh viên ${studentId} đã check-in trong phiên này rồi`
        });
      }

      const student = await Student.findOne({ studentId: studentId.trim() })
        .select("studentId fullName className")
        .lean();

      if (!student) {
        return res.status(404).json({
          success: false,
          message: `Không tìm thấy sinh viên với MSSV ${studentId}`
        });
      }

      if (req.admin.role === "admin" && student.className !== req.admin.className) {
        return res.status(403).json({
          success: false,
          message: `Sinh viên ${student.fullName} không thuộc chi Hội của bạn`
        });
      }

      const record = {
        studentId: student.studentId,
        fullName: student.fullName,
        className: student.className,
        checkinAt: new Date()
      };

      session.checkins.push(record);
      await session.save();

      return res.json({ success: true, checkin: record });
    } catch (error) {
      console.error("Checkin scan error:", error);
      return res.status(500).json({ success: false, message: "Lỗi server khi ghi nhận check-in" });
    }
  }
);

router.get(
  "/checkin/sessions/:id/export",
  requireAdminAuth,
  async (req, res) => {
    try {
      const session = await CheckinSession.findById(req.params.id).lean();

      if (!session) {
        return res.status(404).json({ success: false, message: "Không tìm thấy phiên check-in" });
      }

      const rows = session.checkins.map((c, i) => ({
        STT: i + 1,
        MSSV: c.studentId,
        "Họ và tên": c.fullName,
        "chi Hội": c.className,
        "Thời gian check-in": new Date(c.checkinAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      }));

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(rows, {
        header: ["STT", "MSSV", "Họ và tên", "chi Hội", "Thời gian check-in"]
      });

      ws["!cols"] = [{ wch: 5 }, { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 22 }];

      xlsx.utils.book_append_sheet(wb, ws, "CheckIn");

      const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
      const filename = `checkin-${session.title.replace(/[^a-zA-Z0-9À-ɏḀ-ỿ ]/g, "_")}.xlsx`;

      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return res.send(buffer);
    } catch (error) {
      console.error("Export checkin error:", error);
      return res.status(500).json({ success: false, message: "Lỗi server khi xuất Excel" });
    }
  }
);

router.delete(
  "/checkin/sessions/:id",
  requireAdminAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      await CheckinSession.findByIdAndDelete(req.params.id);
      return res.json({ success: true, message: "Đã xóa phiên check-in" });
    } catch (error) {
      console.error("Delete checkin session error:", error);
      return res.status(500).json({ success: false, message: "Lỗi server" });
    }
  }
);

module.exports = router;