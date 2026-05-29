const mongoose = require("mongoose");

const ruleSchema = new mongoose.Schema(
  {
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

    title: {
      type: String,
      required: true
    },

    requirements: {
      type: [String],
      default: []
    },

    acceptedEvidenceTypes: {
      type: [String],
      default: []
    },

    keywords: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Rule", ruleSchema);