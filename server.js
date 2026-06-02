const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const Evidence = require("./Models/Evidence");

dotenv.config();

const app = express();
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "Public")));

app.get("/uploads/evidence-temp/:filename", async (req, res) => {
  try {
    const token = req.cookies.studentToken || req.cookies.adminToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const filename = path.basename(req.params.filename);

    const filePath = path.join(
      __dirname,
      "uploads",
      "evidence-temp",
      filename
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File không tồn tại"
      });
    }

    const evidence = await Evidence.findOne({
      filePath: {
        $in: [
          `uploads/evidence-temp/${filename}`,
          `uploads\\evidence-temp\\${filename}`,
          filePath
        ]
      }
    });

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy minh chứng tương ứng"
      });
    }

    const isAdmin = Boolean(req.cookies.adminToken);
    const isStudent = Boolean(req.cookies.studentToken);

    if (isStudent) {
      const tokenStudentId =
        decoded.studentId ||
        decoded.id ||
        decoded.username ||
        "";

      if (String(tokenStudentId) !== String(evidence.studentId)) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền xem file này"
        });
      }
    }

    if (isAdmin) {
      // Admin đã đăng nhập được xem file tạm để duyệt minh chứng.
      // Nếu muốn chặt hơn nữa, có thể kiểm tra className của admin với student.className.
    }

    return res.sendFile(filePath);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ"
    });
  }
});

app.get("/", (req, res) => {
  res.redirect("/student.html");
});

// BUG FIX: Sửa đường dẫn Routes (chữ hoa R) để khớp thư mục thực trên Linux
const studentRoutes = require("./Routes/StudentRoutes");
const studentDashboardRoutes = require("./Routes/studentDashboardRoutes");
const evidenceRoutes = require("./Routes/evidenceRoutes");
const adminRoutes = require("./Routes/adminRoutes");
const adminDashboardRoutes = require("./Routes/adminDashboardRoutes");
const pushRoutes = require("./Routes/pushRoutes");

app.use("/api/push", pushRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/student-dashboard", studentDashboardRoutes);
app.use("/api/evidence", evidenceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin-dashboard", adminDashboardRoutes);

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT || 3000, () => {
      console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });