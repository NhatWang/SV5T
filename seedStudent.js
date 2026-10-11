const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Student = require("./models/Student");

dotenv.config();

const testStudents = [
  {
    studentId: "2251123456",
    fullName: "Nguyen Van A",
    className: "24HOH-CLC1"
  },
  {
    studentId: "2251123457",
    fullName: "Tran Thi B",
    className: "24HOH-CLC1"
  },
  {
    studentId: "2251123458",
    fullName: "Le Van C",
    className: "24HOH-CLC1"
  }
];

async function seedStudents() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB connected");

    for (const studentData of testStudents) {
      const existingStudent = await Student.findOne({
        studentId: studentData.studentId
      });

      if (existingStudent) {
        existingStudent.fullName = studentData.fullName;
        existingStudent.className = studentData.className;

        await existingStudent.save();

        console.log(`Updated student: ${studentData.studentId}`);
      } else {
        const newStudent = new Student(studentData);

        await newStudent.save();

        console.log(`Created student: ${studentData.studentId}`);
      }
    }

    console.log("Seed students completed");
    process.exit();
  } catch (error) {
    console.error("Seed students error:", error);
    process.exit(1);
  }
}

seedStudents();