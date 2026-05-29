const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      trim: true
    },

    fullName: {
      type: String,
      default: "",
      trim: true
    },

    className: {
      type: String,
      default: "",
      trim: true
    },

    // Dùng cho Hội nhập tốt:
    // ngoaiNgu / kyNang / hoiNhap
    subCriteria: {
      type: String,
      default: "",
      trim: true
    },

    // Dùng cho Học tập tốt:
    // hocThuat_3_activities / nghienCuu / sangTao / troGiang / baiBao / doiTuyen / khac_direct
    academicEvidenceType: {
      type: String,
      default: "",
      trim: true
    },

    // Dùng cho Tình nguyện tốt
    volunteerDays: {
      type: Number,
      default: 0,
      min: 0
    },
    // Dùng cho Hội nhập tốt - Kỹ năng
    // skill_course / skill_competition_award_khoa_or_above /
    // skill_competition_award_truong_or_above / skill_reporter_khoa_or_above /
    // skill_reporter_truong_or_above / union_association_award_truong_or_above /
    // student_leader_competition_finalist_truong_or_above
    kyNangEvidenceType: {
      type: String,
      default: "",
      trim: true
    },
    hoiNhapEvidenceType: {
      type: String,
      default: "",
      trim: true
    },
  },
  { _id: false }
);

const activitySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      required: true,
      enum: [
        "daoDucTot",
        "hocTapTot",
        "theLucTot",
        "tinhNguyenTot",
        "hoiNhapTot"
      ]
    },

    /*
      Cấp tổ chức / cấp xác nhận thật của hoạt động.
      Admin sẽ nhập cột này trong Excel.
    */
    organizerLevel: {
      type: String,
      enum: [
        "bo_mon",
        "khoa",
        "truong",
        "dhqg",
        "thanh",
        "quoc_gia",
        "quoc_te",
        "khac"
      ],
      default: "khac"
    },
    // Dùng cho Hội nhập tốt - Kỹ năng
    kyNangEvidenceType: {
      type: String,
      default: "",
      trim: true
    },

    hoiNhapEvidenceType: {
      type: String,
      default: "",
      trim: true
    },

    /*
      Các cấp xét mà hoạt động này được hệ thống công nhận.
      Hệ thống tự suy ra từ organizerLevel + category + subCriteria + academicEvidenceType.
      Ví dụ: ["truong"], ["truong", "dhqg"], hoặc ["truong", "dhqg", "thanh"].
    */
    eligibleAwardLevels: {
      type: [String],
      enum: ["truong", "dhqg", "thanh"],
      default: []
    },

    /*
      Giữ lại awardLevel để không làm hỏng dữ liệu/route cũ.
      Sau khi chuyển logic xong, field này chỉ xem như cấp mặc định cũ.
    */
    awardLevel: {
      type: String,
      enum: ["truong", "dhqg", "thanh"],
      default: "truong"
    },

    // Hội nhập tốt: ngoaiNgu / kyNang / hoiNhap
    subCriteria: {
      type: String,
      default: "",
      trim: true
    },

    // Học tập tốt
    academicEvidenceType: {
      type: String,
      default: "",
      trim: true
    },

    // Tình nguyện tốt
    volunteerDays: {
      type: Number,
      default: 0,
      min: 0
    },

    description: {
      type: String,
      default: "",
      trim: true
    },

    date: {
      type: Date,
      default: null
    },

    participants: {
      type: [participantSchema],
      default: []
    },

    uploadedBy: {
      type: String,
      default: "admin"
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.models.Activity || mongoose.model("Activity", activitySchema);