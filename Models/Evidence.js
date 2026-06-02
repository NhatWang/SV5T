const mongoose = require("mongoose");

const evidenceSchema = new mongoose.Schema(
  {
    studentId: {
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
      "hoiNhapTot",
      "khac"
    ]
    },

    awardLevel: {
      type: String,
      enum: ["truong", "dhqg", "thanh", "trung_uong"],
      default: "truong"
    },

    evidenceType: {
  type: String,
  enum: [
    "default",
    "central_mandatory",
    "central_additional"
  ],
  default: "default"
},

additionalCriteriaKey: {
  type: String,
  default: ""
},

    fileName: {
      type: String,
      required: true,
      trim: true
    },

    // Local temp path.
    // Không required vì sau khi upload R2 sẽ set filePath = ""
    filePath: {
      type: String,
      default: ""
    },

    fileType: {
      type: String,
      default: ""
    },

    // Cloudflare R2 object key
    fileKey: {
      type: String,
      default: ""
    },

    // Public URL hoặc custom domain URL của R2
    fileUrl: {
      type: String,
      default: ""
    },

    fileSize: {
      type: Number,
      default: 0
    },

    // Trạng thái lưu trữ file
    storageStatus: {
      type: String,
      enum: ["local_temp", "r2_archived", "deleted", "none"],
      default: "none"
    },

    status: {
      type: String,
      enum: [
        "pending",
        "ai_valid",
        "ai_invalid",
        "partial_valid",
        "manual_review",
        "approved_by_admin",
        "rejected_by_admin",
        "need_more_info"
      ],
      default: "pending"
    },

    aiResult: {
      isValid: {
        type: Boolean,
        default: null
      },

      confidence: {
        type: Number,
        default: 0
      },

      matchedType: {
        type: String,
        default: ""
      },

      volunteerDays: {
        type: Number,
        default: 0
      },

      volunteerActivityName: {
        type: String,
        default: ""
      },

      extractedText: {
        type: String,
        default: ""
      },

      matchedEvidence: {
        type: [String],
        default: []
      },

      missingInfo: {
        type: [String],
        default: []
      },

      reason: {
        type: String,
        default: ""
      },

      // Dùng cho Hội nhập tốt:
      // ngoaiNgu / kyNang / hoiNhap
      subCriteria: {
        type: String,
        default: ""
      },

      // Dùng cho Học tập tốt:
      // hocThuat_3_activities / nghienCuu / sangTao / troGiang / baiBao / doiTuyen / khac_direct
      academicEvidenceType: {
        type: String,
        default: ""
      },

      academicActivityCount: {
        type: Number,
        default: 0
      },

      hasVolunteerAward: {
        type: Boolean,
        default: false
      },

      foreignLanguageEvidenceType: {
        type: String,
        default: ""
      },

      awardRank: {
        type: String,
        default: ""
      },

      organizerLevel: {
        type: String,
        default: ""
      },

      kyNangEvidenceType: {
        type: String,
        default: ""
      },
      hoiNhapEvidenceType: {
        type: String,
        default: ""
      },
      sv5tHistoryType: {
  type: String,
  default: ""
},

sv5tHistoryLevel: {
  type: String,
  default: ""
},

sv5tHistoryYears: {
  type: [String],
  default: []
},

consecutiveYears: {
  type: Number,
  default: 0
},

issuer: {
  type: String,
  default: ""
},

awardTitle: {
  type: String,
  default: ""
},
    },

    adminReview: {
      reviewedBy: {
        type: String,
        default: ""
      },

      reviewedAt: {
        type: Date,
        default: null
      },

      note: {
        type: String,
        default: ""
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.models.Evidence || mongoose.model("Evidence", evidenceSchema);