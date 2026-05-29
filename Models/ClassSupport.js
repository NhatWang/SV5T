const mongoose = require("mongoose");

const personSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      default: "",
      trim: true
    },

    phone: {
      type: String,
      default: "",
      trim: true
    },

    zalo: {
      type: String,
      default: "",
      trim: true
    }
  },
  { _id: false }
);

const classSupportSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    chiHoiTruong: {
      type: personSchema,
      default: () => ({})
    },

    // 0 hoặc 1 Chi Hội phó
    chiHoiPho: {
      type: personSchema,
      default: () => ({})
    },

    // 2 hoặc 3 Ủy viên BCH
    uyVienBCHList: {
      type: [personSchema],
      default: []
    },

    // 0 hoặc 1 CTV BCH
    ctvBCH: {
      type: personSchema,
      default: () => ({})
    },

    updatedBy: {
      type: String,
      default: "",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.models.ClassSupport ||
  mongoose.model("ClassSupport", classSupportSchema);