const Student = require("../Models/Student");
const Evidence = require("../Models/Evidence");
const Activity = require("../Models/Activity");

const {
  isValidKyNangEvidenceForLevel,
  isValidHoiNhapEvidenceForLevel
} = require("./activityEligibility");

const categories = [
  "daoDucTot",
  "hocTapTot",
  "theLucTot",
  "tinhNguyenTot",
  "hoiNhapTot"
];

const DIRECT_HOC_TAP_TYPES = [
  "nghienCuu",
  "sangTao",
  "troGiang",
  "baiBao",
  "doiTuyen",
  "khac_direct"
];

function getStudentCompletedCount(student) {
  let completed = 0;

  categories.forEach((category) => {
    if (
      student.sv5tProgress &&
      student.sv5tProgress[category] &&
      student.sv5tProgress[category].isCompleted
    ) {
      completed++;
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

async function recomputeTinhNguyenProgress(studentId) {
  const student = await Student.findOne({ studentId });

  if (!student || !student.sv5tProgress?.tinhNguyenTot) {
    return;
  }

  const progress = student.sv5tProgress.tinhNguyenTot;

  const validEvidences = await Evidence.find({
    studentId,
    category: "tinhNguyenTot",
    awardLevel: "truong",
    status: {
      $in: ["ai_valid", "partial_valid", "approved_by_admin"]
    }
  });

  const adminActivities = await Activity.find({
    category: "tinhNguyenTot",
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

  let totalDays = 0;
  let hasVolunteerAward = false;

  validEvidences.forEach((evidence) => {
    const days = Number(evidence.aiResult?.volunteerDays || 0);
    totalDays += days;

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

  adminActivities.forEach((activity) => {
    const participant = activity.participants.find((p) => {
      return p.studentId === studentId;
    });

    const days =
      Number(participant?.volunteerDays || 0) ||
      Number(activity.volunteerDays || 0);

    totalDays += days;
  });

  progress.volunteerDays = totalDays;
  progress.hasVolunteerAward = hasVolunteerAward;

  if (hasVolunteerAward || totalDays >= 5) {
    progress.isCompleted = true;
    progress.completedBy = "activity_and_evidence";
    progress.completedAt = progress.completedAt || new Date();
  } else {
    progress.isCompleted = false;
    progress.completedBy = "none";
    progress.completedAt = null;
  }

  updateStudentProgressSummary(student);

  await student.save();
}

async function recomputeHoiNhapProgress(studentId) {
  const student = await Student.findOne({ studentId });

  if (!student || !student.sv5tProgress?.hoiNhapTot) {
    return;
  }

  const progress = student.sv5tProgress.hoiNhapTot;

  if (!progress.subProgress) {
    progress.subProgress = {
      ngoaiNgu: false,
      kyNang: false,
      hoiNhap: false
    };
  }

  const subProgress = {
    ngoaiNgu: false,
    kyNang: false,
    hoiNhap: false
  };

  const validEvidences = await Evidence.find({
    studentId,
    category: "hoiNhapTot",
    awardLevel: "truong",
    status: {
      $in: ["ai_valid", "approved_by_admin"]
    }
  });

  const adminActivities = await Activity.find({
    category: "hoiNhapTot",
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

  validEvidences.forEach((evidence) => {
    const sub = evidence.aiResult?.subCriteria || "";

    if (sub === "ngoaiNgu") {
      subProgress.ngoaiNgu = true;
    }

    if (sub === "kyNang") {
      const kyNangEvidenceType = evidence.aiResult?.kyNangEvidenceType || "";

      if (isValidKyNangEvidenceForLevel("truong", kyNangEvidenceType)) {
        subProgress.kyNang = true;
      }
    }

    if (sub === "hoiNhap") {
      const hoiNhapEvidenceType = evidence.aiResult?.hoiNhapEvidenceType || "";

      if (isValidHoiNhapEvidenceForLevel("truong", hoiNhapEvidenceType)) {
        subProgress.hoiNhap = true;
      }
    }
  });

  adminActivities.forEach((activity) => {
    const participant = activity.participants.find((p) => {
      return p.studentId === studentId;
    });

    const sub = participant?.subCriteria || activity.subCriteria || "";

    if (sub === "ngoaiNgu") {
      subProgress.ngoaiNgu = true;
    }

    if (sub === "kyNang") {
      const kyNangEvidenceType =
        participant?.kyNangEvidenceType ||
        activity.kyNangEvidenceType ||
        "";

      if (isValidKyNangEvidenceForLevel("truong", kyNangEvidenceType)) {
        subProgress.kyNang = true;
      }
    }

    if (sub === "hoiNhap") {
      const hoiNhapEvidenceType =
        participant?.hoiNhapEvidenceType ||
        activity.hoiNhapEvidenceType ||
        "";

      if (isValidHoiNhapEvidenceForLevel("truong", hoiNhapEvidenceType)) {
        subProgress.hoiNhap = true;
      }
    }
  });

  progress.subProgress.ngoaiNgu = subProgress.ngoaiNgu;
  progress.subProgress.kyNang = subProgress.kyNang;
  progress.subProgress.hoiNhap = subProgress.hoiNhap;

  if (subProgress.ngoaiNgu && subProgress.kyNang && subProgress.hoiNhap) {
    progress.isCompleted = true;
    progress.completedBy = "activity_and_evidence";
    progress.completedAt = progress.completedAt || new Date();
  } else {
    progress.isCompleted = false;
    progress.completedBy = "none";
    progress.completedAt = null;
  }

  updateStudentProgressSummary(student);

  await student.save();
}

async function recomputeHocTapProgress(studentId) {
  const student = await Student.findOne({ studentId });

  if (!student || !student.sv5tProgress?.hocTapTot) {
    return;
  }

  const progress = student.sv5tProgress.hocTapTot;

  const validEvidences = await Evidence.find({
    studentId,
    category: "hocTapTot",
    awardLevel: "truong",
    status: {
      $in: ["ai_valid", "partial_valid", "approved_by_admin"]
    }
  });

  const adminActivities = await Activity.find({
    category: "hocTapTot",
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

  let academicActivityCount = 0;
  let academicDirectPassed = false;

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

  adminActivities.forEach((activity) => {
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

  progress.academicActivityCount = academicActivityCount;
  progress.academicDirectPassed = academicDirectPassed;

  progress.extraPassed = academicDirectPassed || academicActivityCount >= 3;

  if (progress.extraPassed && !progress.extraCompletedAt) {
    progress.extraCompletedAt = new Date();
  }

  if (progress.mandatoryPassed && progress.extraPassed) {
    progress.isCompleted = true;
    progress.completedBy = "activity_and_evidence";
    progress.completedAt = progress.completedAt || new Date();
  } else {
    progress.isCompleted = false;
    progress.completedBy = "none";
    progress.completedAt = null;
  }

  updateStudentProgressSummary(student);

  await student.save();
}

module.exports = {
  recomputeHocTapProgress,
  recomputeTinhNguyenProgress,
  recomputeHoiNhapProgress
};