const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const cookieParser = require("cookie-parser");

dotenv.config();

const app = express();
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "Public")));

app.get("/", (req, res) => {
  res.redirect("/student.html");
});

// BUG FIX: Sửa đường dẫn Routes (chữ hoa R) để khớp thư mục thực trên Linux
const studentRoutes = require("./Routes/StudentRoutes");
const studentDashboardRoutes = require("./Routes/studentDashboardRoutes");
const evidenceRoutes = require("./Routes/evidenceRoutes");
const adminRoutes = require("./Routes/adminRoutes");
const adminDashboardRoutes = require("./Routes/adminDashboardRoutes");

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