require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Admin = require("../Models/Admin");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL;

const classes = [
  "25HOH_TN",
  "25HOH1",
  "25HOH2",
  "25HOH_DKD1",
  "25HOH_DKD2",
  "25HOH_DKD3",
  "25CKH1",
  "24HOH1",
  "24HOH2",
  "24HOH_CLC3",
  "24CKH1",
  "24CKH2",
  "24CKH3"
];

function buildUsername(className) {
  return `admin_${className.toLowerCase()}`;
}

async function main() {
  if (!MONGO_URI) {
    throw new Error("Missing MONGO_URI or MONGODB_URI in .env");
  }

  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");

  const defaultPassword = "Admin@123456";
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  let created = 0;
  let updated = 0;

  for (const className of classes) {
    const username = buildUsername(className);

    const existingAdmin = await Admin.findOne({ username });

    if (existingAdmin) {
      existingAdmin.role = "admin";
      existingAdmin.className = className;

      // Không tự đổi password nếu tài khoản đã tồn tại
      await existingAdmin.save();

      updated += 1;
      console.log(`Updated: ${username} -> ${className}`);
      continue;
    }

    await Admin.create({
      username,
      password: hashedPassword,
      role: "admin",
      className
    });

    created += 1;
    console.log(`Created: ${username} -> ${className}`);
  }

  console.log("Done");
  console.log({
    totalClasses: classes.length,
    created,
    updated,
    defaultPassword
  });

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Create class admins error:", error);
  await mongoose.disconnect();
  process.exit(1);
});

