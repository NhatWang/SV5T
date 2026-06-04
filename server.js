const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const Evidence = require("./Models/Evidence");

dotenv.config();

const app = express();

// ─────────────────────────────────────────
// SECURITY MIDDLEWARES
// ─────────────────────────────────────────

// Helmet: tự động thêm các HTTP security headers
// Tắt contentSecurityPolicy vì frontend dùng inline script/style (HTML thuần)
app.use(helmet({
  contentSecurityPolicy: false
}));

// CORS: chỉ cho phép domain trong ALLOWED_ORIGIN
// Mặc định localhost:3000 khi dev, production phải set biến môi trường
const allowedOrigins = (process.env.ALLOWED_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(cors({
  origin: function (origin, callback) {
    // Cho phép request không có origin (Postman, mobile app, same-origin)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS: origin "${origin}" không được phép`));
  },
  credentials: true
}));
// ─────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────
const rateLimit = require("express-rate-limit");

// Giới hạn chung cho toàn bộ API — chặn flood request
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 300,                  // tối đa 300 request/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút." }
});

// Login sinh viên — chặn brute-force mật khẩu
const studentLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Đăng nhập thất bại quá nhiều lần. Vui lòng thử lại sau 15 phút." }
});

// Login admin — chặt hơn vì quyền cao hơn
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Đăng nhập admin thất bại quá nhiều lần. Vui lòng thử lại sau 15 phút." }
});

// Upload minh chứng — tránh spam gọi Gemini API tốn tiền
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Upload quá nhiều lần. Vui lòng thử lại sau 15 phút." }
});

// Reset mật khẩu — tránh spam OTP
const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 tiếng
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau 1 tiếng." }
});

app.use("/api", globalLimiter);
app.use("/api/student/login", studentLoginLimiter);
app.use("/api/student/reset-password", resetPasswordLimiter);
app.use("/api/admin/login", adminLoginLimiter);
app.use("/api/evidence/upload", uploadLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// FIX #4: Dùng chữ thường "public" — Linux phân biệt hoa/thường, "Public" sẽ lỗi nếu thư mục thực là "public"
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
const chatbotRoutes = require("./Routes/chatbotRoutes");
// FIX #1: Thêm activityRoutes (trước đây bị thiếu, khiến /api/activity/* trả 404)
const activityRoutes = require("./Routes/activityRoutes");

app.use("/api/push", pushRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/student-dashboard", studentDashboardRoutes);
app.use("/api/evidence", evidenceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin-dashboard", adminDashboardRoutes);
app.use("/api/activity", activityRoutes);

// ─────────────────────────────────────────
// CENTRALIZED ERROR HANDLER — phải đặt sau tất cả routes
// ─────────────────────────────────────────
const errorHandler = require("./Middlewares/errorHandler");
app.use(errorHandler);

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