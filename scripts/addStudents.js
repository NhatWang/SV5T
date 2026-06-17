/**
 * Bổ sung sinh viên từ file Excel vào MongoDB.
 * Khác với upload qua UI: không chặn khi lớp đã tồn tại, chỉ thêm mới / cập nhật tên.
 *
 * Cột Excel cần có: studentId | fullName | className
 *
 * Cách dùng:
 *   node scripts/addStudents.js path/to/file.xlsx
 *   node scripts/addStudents.js path/to/file.xlsx --dry-run
 */

require("dotenv").config();
const path = require("path");
const mongoose = require("mongoose");
const xlsx = require("xlsx");

const Student = require("../Models/Student");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL;

const filePath = process.argv[2];
const DRY_RUN = process.argv.includes("--dry-run");

if (!filePath) {
  console.error("Cách dùng: node scripts/addStudents.js <file.xlsx> [--dry-run]");
  process.exit(1);
}

function getCellValue(row, key) {
  const val = row[key];
  if (val === undefined || val === null) return "";
  return String(val).trim();
}

async function main() {
  if (!MONGO_URI) throw new Error("Missing MONGO_URI / MONGODB_URI in .env");

  const workbook = xlsx.readFile(path.resolve(filePath));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet);

  console.log(`Đọc được ${rows.length} dòng từ file.`);
  if (DRY_RUN) console.log("⚠️  DRY RUN — không ghi vào database.\n");

  const valid = [];
  const errors = [];
  const seenIds = new Set();

  for (const row of rows) {
    const studentId = getCellValue(row, "studentId");
    const fullName  = getCellValue(row, "fullName");
    const className = getCellValue(row, "className");

    if (!studentId || !fullName || !className) {
      errors.push({ studentId: studentId || "(trống)", reason: "Thiếu studentId, fullName hoặc className" });
      continue;
    }

    if (seenIds.has(studentId)) {
      errors.push({ studentId, reason: "Trùng MSSV trong file" });
      continue;
    }

    seenIds.add(studentId);
    valid.push({ studentId, fullName, className });
  }

  if (errors.length) {
    console.log(`\n❌ ${errors.length} dòng lỗi:`);
    errors.forEach((e) => console.log(`   ${e.studentId}: ${e.reason}`));
  }

  if (valid.length === 0) {
    console.log("\nKhông có dòng hợp lệ. Dừng.");
    return;
  }

  console.log(`\n✅ ${valid.length} dòng hợp lệ.`);

  // Preview 5 dòng đầu
  valid.slice(0, 5).forEach((s) =>
    console.log(`   ${s.studentId} | ${s.fullName} | ${s.className}`)
  );
  if (valid.length > 5) console.log(`   ... và ${valid.length - 5} dòng khác`);

  if (DRY_RUN) return;

  await mongoose.connect(MONGO_URI);
  console.log("\nMongoDB connected");

  const existingIds = new Set(
    (await Student.find({ studentId: { $in: valid.map((s) => s.studentId) } }).select("studentId").lean())
      .map((s) => s.studentId)
  );

  let inserted = 0;
  let updated = 0;

  const ops = valid.map((s) => {
    if (existingIds.has(s.studentId)) {
      updated++;
    } else {
      inserted++;
    }

    return {
      updateOne: {
        filter: { studentId: s.studentId },
        update: {
          $set:         { fullName: s.fullName, className: s.className },
          $setOnInsert: {
            studentId:               s.studentId,
            isActivated:             false,
            password:                null,
            sv5tStatus:              "not_started",
            sv5tProgress:            {},
            totalCompletedCriteria:  0,
            progressPercent:         0,
            createdAt:               new Date()
          }
        },
        upsert: true
      }
    };
  });

  await Student.bulkWrite(ops, { ordered: false });

  console.log(`\nHoàn tất:`);
  console.log(`  Thêm mới : ${inserted}`);
  console.log(`  Cập nhật : ${updated}`);
  console.log(`  Tổng     : ${valid.length}`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Lỗi:", err);
  await mongoose.disconnect();
  process.exit(1);
});
