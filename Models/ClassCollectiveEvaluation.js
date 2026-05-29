const mongoose = require("mongoose");

const classCollectiveEvaluationSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    chiHoiRating: {
      type: String,
      enum: ["manh", "kha", "trung_binh", "yeu", "unknown"],
      default: "unknown"
    },

    hasRegistrationForm: {
      type: Boolean,
      default: false
    },

    hasSupportActivities: {
      type: Boolean,
      default: false
    },

    hasViolation: {
      type: Boolean,
      default: false
    },

    updatedBy: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.models.ClassCollectiveEvaluation ||
  mongoose.model("ClassCollectiveEvaluation", classCollectiveEvaluationSchema);