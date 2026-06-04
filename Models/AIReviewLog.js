const mongoose = require("mongoose");

const aiReviewLogSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      trim: true
    },

    evidenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evidence",
      default: null
    },

    category: {
      type: String,
      default: ""
    },

    awardLevel: {
      type: String,
      default: "truong"
    },

    model: {
      type: String,
      default: process.env.AZURE_FOUNDRY_MODEL || ""
    },

    promptVersion: {
      type: String,
      default: ""
    },

    inputType: {
      type: String,
      default: ""
    },

    extractedTextLength: {
      type: Number,
      default: 0
    },

    statusBefore: {
      type: String,
      default: ""
    },

    statusAfter: {
      type: String,
      default: ""
    },

    rawResponse: {
      type: String,
      default: ""
    },

    parsedResult: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    errorMessage: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.models.AIReviewLog ||
  mongoose.model("AIReviewLog", aiReviewLogSchema);