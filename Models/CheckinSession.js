const mongoose = require("mongoose");

const checkinRecordSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  fullName: { type: String, default: "" },
  className: { type: String, default: "" },
  checkinAt: { type: Date, default: Date.now }
});

const checkinSessionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  securityCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  checkins: [checkinRecordSchema]
});

module.exports = mongoose.model("CheckinSession", checkinSessionSchema);
