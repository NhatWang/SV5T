const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const Admin = require("./models/Admin");

dotenv.config();

const admins = [
  {
    username: "24hoh_clc1_admin",
    password: "123456",
    role: "admin",
    className: "24HOH-CLC1"
  },
  {
    username: "lch_admin",
    password: "123456",
    role: "super_admin",
    className: ""
  }
];

async function seedAdmins() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB connected");

    for (const adminData of admins) {
      const existingAdmin = await Admin.findOne({
        username: adminData.username
      });

      if (existingAdmin) {
        console.log(`Admin already exists: ${adminData.username}`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(adminData.password, 10);

      const newAdmin = new Admin({
        username: adminData.username,
        password: hashedPassword,
        role: adminData.role,
        className: adminData.className
      });

      await newAdmin.save();

      console.log(`Created admin: ${adminData.username}`);
    }

    console.log("Seed admin completed");
    process.exit();
  } catch (error) {
    console.error("Seed admin error:", error);
    process.exit(1);
  }
}

seedAdmins();