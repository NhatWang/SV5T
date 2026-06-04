const mongoose = require("mongoose");

const completedByEnum = [
  "activity",
  "evidence",
  "admin",
  "system",
  "student_declare",
  "student_declare_and_evidence",
  "activity_and_evidence",
  "none"
];

const criterionSchema = new mongoose.Schema(
  {
    isCompleted: {
      type: Boolean,
      default: false
    },

    completedBy: {
      type: String,
      enum: completedByEnum,
      default: "none"
    },

    completedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

// Riêng cho tiêu chí Học tập tốt
// Học tập tốt = tiêu chuẩn bắt buộc + ít nhất 1 tiêu chuẩn khác
const hocTapCriterionSchema = new mongoose.Schema(
  {
    isCompleted: {
      type: Boolean,
      default: false
    },

    completedBy: {
      type: String,
      enum: completedByEnum,
      default: "none"
    },

    completedAt: {
      type: Date,
      default: null
    },

    // Phần tự khai: GPA, không nợ môn, không gian lận
    mandatoryPassed: {
      type: Boolean,
      default: false
    },

    mandatoryCompletedAt: {
      type: Date,
      default: null
    },

    // Số hoạt động học thuật được ghi nhận
    academicActivityCount: {
      type: Number,
      default: 0,
      min: 0
    },

    // Đạt trực tiếp bằng NCKH, bài báo, trợ giảng, đội tuyển, sáng tạo...
    academicDirectPassed: {
      type: Boolean,
      default: false
    },

    // Phần upload minh chứng học thuật khác
    extraPassed: {
      type: Boolean,
      default: false
    },

    extraCompletedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

// Riêng cho tiêu chí Hội nhập tốt
// Hội nhập tốt = Ngoại ngữ + Kỹ năng + Hoạt động hội nhập
const hoiNhapCriterionSchema = new mongoose.Schema(
  {
    isCompleted: {
      type: Boolean,
      default: false
    },

    completedBy: {
      type: String,
      enum: completedByEnum,
      default: "none"
    },

    completedAt: {
      type: Date,
      default: null
    },

    subProgress: {
      ngoaiNgu: {
        type: Boolean,
        default: false
      },

      kyNang: {
        type: Boolean,
        default: false
      },

      hoiNhap: {
        type: Boolean,
        default: false
      }
    }
  },
  { _id: false }
);

// Riêng cho tiêu chí Tình nguyện tốt
const tinhNguyenCriterionSchema = new mongoose.Schema(
  {
    isCompleted: {
      type: Boolean,
      default: false
    },

    completedBy: {
      type: String,
      enum: completedByEnum,
      default: "none"
    },

    completedAt: {
      type: Date,
      default: null
    },

    volunteerDays: {
      type: Number,
      default: 0,
      min: 0
    },

    hasVolunteerAward: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

// Dữ liệu sinh viên tự khai theo từng cấp xét
// Đạo đức tốt và Học tập bắt buộc/GPA sẽ được hệ thống tự so điều kiện
const selfDeclarationSchema = new mongoose.Schema(
  {
    awardLevel: {
      type: String,
      enum: ["truong", "dhqg", "thanh"],
      default: "truong"
    },

    category: {
      type: String,
      enum: ["daoDucTot", "hocTapTot", "theLucTot", "tinhNguyenTot", "hoiNhapTot"],
      required: true
    },

    subCriteria: {
      type: String,
      default: "",
      trim: true
    },

    type: {
      type: String,
      default: "",
      trim: true
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    isCompleted: {
      type: Boolean,
      default: false
    },

    reason: {
      type: String,
      default: ""
    },

    evaluatedBy: {
      type: String,
      enum: ["system"],
      default: "system"
    },

    declaredAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const aiSuggestionSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: [
        "daoDucTot",
        "hocTapTot",
        "theLucTot",
        "tinhNguyenTot",
        "hoiNhapTot",
        "general"
      ],
      default: "general"
    },

    message: {
      type: String,
      required: true
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const studentSchema = new mongoose.Schema(
  {
    // 1. Thông tin sinh viên
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    fullName: {
      type: String,
      required: true,
      trim: true
    },

    className: {
      type: String,
      default: "",
      trim: true
    },

    // 2. Thông tin đăng nhập
    password: {
      type: String,
      default: null
    },

    isActivated: {
      type: Boolean,
      default: false
    },

    lastLogin: {
      type: Date,
      default: null
    },

    resetPasswordCodeHash: {
      type: String,
      default: ""
    },

    resetPasswordExpiresAt: {
      type: Date,
      default: null
    },

    resetPasswordUsed: {
      type: Boolean,
      default: false
    },

    // 3. Tiến độ Sinh viên 5 tốt cấp Trường hiện tại
    sv5tProgress: {
      daoDucTot: {
        type: criterionSchema,
        default: () => ({})
      },

      hocTapTot: {
        type: hocTapCriterionSchema,
        default: () => ({})
      },

      theLucTot: {
        type: criterionSchema,
        default: () => ({})
      },

      tinhNguyenTot: {
        type: tinhNguyenCriterionSchema,
        default: () => ({})
      },

      hoiNhapTot: {
        type: hoiNhapCriterionSchema,
        default: () => ({})
      }
    },

    // 3.1. Dữ liệu tự khai theo từng cấp: truong / dhqg / thanh
    selfDeclarations: {
      type: [selfDeclarationSchema],
      default: []
    },

    // 4. Thống kê tổng quan cấp Trường
    totalCompletedCriteria: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },

    progressPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    // 5. Trạng thái xét SV5T tổng thể cấp Trường
    sv5tStatus: {
      type: String,
      enum: [
        "not_started",
        "in_progress",
        "completed",
        "submitted",
        "approved",
        "rejected"
      ],
      default: "not_started"
    },

    dhqgProgress: {
  type: mongoose.Schema.Types.Mixed,
  default: {}
},

thanhProgress: {
  type: mongoose.Schema.Types.Mixed,
  default: {}
},

centralProgress: {
  type: mongoose.Schema.Types.Mixed,
  default: {}
},

centralSummary: {
  type: mongoose.Schema.Types.Mixed,
  default: {}
},

    // 6. Tiến độ cấp xét cao hơn: ĐHQG-HCM, Thành phố

    higherLevelStatus: {
  dhqg: {
    completedCount: {
      type: Number,
      default: 0
    },
    progressPercent: {
      type: Number,
      default: 0
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    updatedAt: {
      type: Date,
      default: null
    }
  },

  thanh: {
    completedCount: {
      type: Number,
      default: 0
    },
    progressPercent: {
      type: Number,
      default: 0
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    updatedAt: {
      type: Date,
      default: null
    }
  }
},

    // 7. Gợi ý AI trên trang Tổng quan
    aiSuggestions: {
      type: [aiSuggestionSchema],
      default: []
    },

    // 7. Ghi chú của admin
    adminNotes: {
      type: String,
      default: ""
    },
  },

  {
    timestamps: true
  }
);

studentSchema.index({ studentId: 1 }, { unique: true });
studentSchema.index({ className: 1 });
studentSchema.index({ sv5tStatus: 1 });
studentSchema.index({ totalCompletedCriteria: 1 });
studentSchema.index({ className: 1, totalCompletedCriteria: 1 });
module.exports =
  mongoose.models.Student || mongoose.model("Student", studentSchema);