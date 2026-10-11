require("node:dns").setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "/Users/nhatwang/CODE/SV5T/.env" });

const Student = require("/Users/nhatwang/CODE/SV5T/Models/Student");
const Activity = require("/Users/nhatwang/CODE/SV5T/Models/Activity");

const TEST_STUDENT_ID = "TEST00001";

async function main() {
  await mongoose.connect(process.env.MONGO_URL);

  const now = new Date();

  const fullProgress = {
    daoDucTot: { isCompleted: true, completedBy: "admin", completedAt: now },
    hocTapTot: {
      isCompleted: true,
      completedBy: "admin",
      completedAt: now,
      mandatoryPassed: true,
      mandatoryCompletedAt: now,
      academicActivityCount: 3,
      academicDirectPassed: true,
      extraPassed: true,
      extraCompletedAt: now
    },
    theLucTot: { isCompleted: true, completedBy: "admin", completedAt: now },
    tinhNguyenTot: {
      isCompleted: true,
      completedBy: "admin",
      completedAt: now,
      volunteerDays: 10,
      hasVolunteerAward: true
    },
    hoiNhapTot: {
      isCompleted: true,
      completedBy: "admin",
      completedAt: now,
      subProgress: { ngoaiNgu: true, kyNang: true, hoiNhap: true }
    }
  };

  // Route xét cấp cao hơn (dhqg/thanh) chỉ đọc lại self-declare đã khai ở
  // cấp Trường ("truong") rồi tự so với ngưỡng của cấp đang xét — nên chỉ
  // cần 1 bản khai duy nhất ở awardLevel "truong" với số đủ cao để qua hết
  // các ngưỡng (truong/dhqg/thanh).
  const selfDeclarations = [
    {
      awardLevel: "truong",
      category: "daoDucTot",
      data: {
        trainingScore: 95,
        noLawViolation: true,
        noRuleViolation: true,
        excellentUnionMember: true
      },
      isCompleted: true,
      declaredAt: now
    },
    {
      awardLevel: "truong",
      category: "hocTapTot",
      data: {
        gpaScale: "4",
        gpaValue: 3.9,
        properLearningAttitude: true,
        noAcademicViolation: true,
        noFailedSubjects: true
      },
      isCompleted: true,
      declaredAt: now
    }
  ];

  const centralProgress = {};
  ["daoDucTot", "hocTapTot", "theLucTot", "tinhNguyenTot", "hoiNhapTot"].forEach((cat) => {
    centralProgress[cat] = {
      isCompleted: true,
      completedBy: "admin_approved_mandatory_evidence",
      completedAt: now,
      adminApproved: true,
      referencePassed: false,
      status: "completed_by_admin"
    };
  });

  const centralSummary = {
    mandatoryCompletedCount: 5,
    mandatoryProgressPercent: 100,
    additionalCriteriaCount: 2,
    additionalProgressPercent: 100,
    isCentralQualified: true,
    updatedAt: now
  };

  const doc = await Student.findOneAndUpdate(
    { studentId: TEST_STUDENT_ID },
    {
      studentId: TEST_STUDENT_ID,
      fullName: "Nguyễn Văn Test",
      className: "TEST-CLC1",
      isActivated: true,
      sv5tProgress: fullProgress,
      selfDeclarations,
      totalCompletedCriteria: 5,
      progressPercent: 100,
      sv5tStatus: "completed",
      centralProgress,
      centralSummary
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  doc.markModified("centralProgress");
  doc.markModified("centralSummary");
  await doc.save();

  // Xoá activity test cũ (nếu chạy lại script) rồi tạo lại cho sạch.
  await Activity.deleteMany({ title: /^\[TEST\]/ });

  const baseParticipant = {
    studentId: TEST_STUDENT_ID,
    fullName: doc.fullName,
    className: doc.className
  };

  const activities = [
    {
      title: "[TEST] Hoạt động học thuật mẫu",
      category: "hocTapTot",
      organizerLevel: "quoc_te",
      eligibleAwardLevels: ["truong", "dhqg", "thanh"],
      awardLevel: "dhqg",
      participants: [{ ...baseParticipant }]
    },
    {
      title: "[TEST] Giải thể thao mẫu",
      category: "theLucTot",
      organizerLevel: "quoc_te",
      eligibleAwardLevels: ["truong", "dhqg", "thanh"],
      awardLevel: "dhqg",
      participants: [{ ...baseParticipant }]
    },
    {
      title: "[TEST] Chiến dịch tình nguyện mẫu",
      category: "tinhNguyenTot",
      organizerLevel: "quoc_te",
      eligibleAwardLevels: ["truong", "dhqg", "thanh"],
      awardLevel: "dhqg",
      volunteerDays: 10,
      isVolunteerAward: true,
      participants: [{ ...baseParticipant, volunteerDays: 10, isVolunteerAward: true }]
    },
    {
      title: "[TEST] Chứng chỉ ngoại ngữ mẫu",
      category: "hoiNhapTot",
      organizerLevel: "quoc_te",
      eligibleAwardLevels: ["truong", "dhqg", "thanh"],
      awardLevel: "dhqg",
      subCriteria: "ngoaiNgu",
      participants: [{ ...baseParticipant, subCriteria: "ngoaiNgu" }]
    },
    {
      title: "[TEST] Khóa kỹ năng thực hành xã hội mẫu",
      category: "hoiNhapTot",
      organizerLevel: "quoc_te",
      eligibleAwardLevels: ["truong", "dhqg", "thanh"],
      awardLevel: "dhqg",
      subCriteria: "kyNang",
      kyNangEvidenceType: "skill_course",
      participants: [{ ...baseParticipant, subCriteria: "kyNang", kyNangEvidenceType: "skill_course" }]
    },
    {
      title: "[TEST] Giao lưu quốc tế mẫu",
      category: "hoiNhapTot",
      organizerLevel: "quoc_te",
      eligibleAwardLevels: ["truong", "dhqg", "thanh"],
      awardLevel: "dhqg",
      subCriteria: "hoiNhap",
      hoiNhapEvidenceType: "international_exchange",
      participants: [{ ...baseParticipant, subCriteria: "hoiNhap", hoiNhapEvidenceType: "international_exchange" }]
    }
  ];

  await Activity.insertMany(activities);

  const token = jwt.sign(
    {
      type: "student",
      studentId: doc.studentId,
      fullName: doc.fullName,
      className: doc.className
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  console.log("STUDENT_ID=" + doc.studentId);
  console.log("TOKEN=" + token);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
