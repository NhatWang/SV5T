/**
 * Đổi tên lớp đồng loạt trên toàn bộ MongoDB.
 * Cập nhật tất cả collections có chứa trường className.
 *
 * Cách dùng:
 *   node scripts/renameClass.js TEN_CU TEN_MOI
 *   node scripts/renameClass.js 24HOH1 24HOH_CLC1 --dry-run
 */

require("dotenv").config();
const mongoose = require("mongoose");

const Student                 = require("../Models/Student");
const Admin                   = require("../Models/Admin");
const Evidence                = require("../Models/Evidence");
const Activity                = require("../Models/Activity");
const ClassSupport            = require("../Models/ClassSupport");
const ClassCollectiveEvaluation = require("../Models/ClassCollectiveEvaluation");
const PushSubscription        = require("../Models/PushSubscription");
const CheckinSession          = require("../Models/CheckinSession");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL;

const [,, oldName, newName] = process.argv;
const DRY_RUN = process.argv.includes("--dry-run");

if (!oldName || !newName) {
  console.error("Cách dùng: node scripts/renameClass.js <tên_cũ> <tên_mới> [--dry-run]");
  process.exit(1);
}

if (oldName === newName) {
  console.error("Tên cũ và tên mới giống nhau. Dừng.");
  process.exit(1);
}

async function updateCollection(model, filter, update, label) {
  const count = await model.countDocuments(filter);
  if (count === 0) {
    console.log(`  ${label}: 0 doc (bỏ qua)`);
    return;
  }
  if (DRY_RUN) {
    console.log(`  ${label}: ${count} doc sẽ được cập nhật (dry run)`);
    return;
  }
  const result = await model.updateMany(filter, update);
  console.log(`  ${label}: ${result.modifiedCount}/${count} doc đã cập nhật`);
}

async function main() {
  if (!MONGO_URI) throw new Error("Missing MONGO_URI / MONGODB_URI in .env");

  console.log(`\nĐổi tên lớp: "${oldName}" → "${newName}"`);
  if (DRY_RUN) console.log("⚠️  DRY RUN — không ghi vào database.\n");

  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected\n");

  await updateCollection(
    Student, { className: oldName }, { $set: { className: newName } }, "Student"
  );

  await updateCollection(
    Admin, { className: oldName }, { $set: { className: newName } }, "Admin"
  );

  await updateCollection(
    Evidence, { className: oldName }, { $set: { className: newName } }, "Evidence"
  );

  await updateCollection(
    Activity, { "participants.className": oldName },
    { $set: { "participants.$[el].className": newName } },
    "Activity (participants)"
  );

  await updateCollection(
    ClassSupport, { className: oldName }, { $set: { className: newName } }, "ClassSupport"
  );

  await updateCollection(
    ClassCollectiveEvaluation, { className: oldName }, { $set: { className: newName } }, "ClassCollectiveEvaluation"
  );

  await updateCollection(
    PushSubscription, { className: oldName }, { $set: { className: newName } }, "PushSubscription"
  );

  await updateCollection(
    CheckinSession, { className: oldName }, { $set: { className: newName } }, "CheckinSession"
  );

  console.log("\nHoàn tất.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Lỗi:", err);
  await mongoose.disconnect();
  process.exit(1);
});
