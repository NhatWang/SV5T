const express = require("express");
const Activity = require("../Models/Activity");
const Student = require("../Models/Student");

const {
  requireAdminAuth,
  requireStudentAuth
} = require("../Middlewares/authMiddleware");

// FIX #5/#6: Dùng recompute functions từ progressRecompute thay vì hàm local đơn giản
const {
  recomputeHocTapProgress,
  recomputeTinhNguyenProgress,
  recomputeHoiNhapProgress
} = require("../Utils/progressRecompute");

const router = express.Router();

const validCategories = [
  "daoDucTot",
  "hocTapTot",
  "theLucTot",
  "tinhNguyenTot",
  "hoiNhapTot"
];

// Các tiêu chí có logic recompute riêng (không set isCompleted trực tiếp)
const RECOMPUTE_CATEGORIES = ["hocTapTot", "tinhNguyenTot", "hoiNhapTot"];

// POST /api/activity/create
router.post("/create", requireAdminAuth, async (req, res) => {
  try {
    const { title, category, description, date, participants } = req.body;

    if (!title || !category) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập tên hoạt động và tiêu chí"
      });
    }

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Tiêu chí không hợp lệ"
      });
    }

    if (!Array.isArray(participants)) {
      return res.status(400).json({
        success: false,
        message: "Danh sách sinh viên tham gia phải là một mảng"
      });
    }

    const cleanedParticipants = participants
      .filter((p) => p.studentId)
      .map((p) => ({
        studentId: String(p.studentId).trim(),
        fullName: p.fullName || "",
        className: p.className || ""
      }));

    const activity = new Activity({
      title,
      category,
      description: description || "",
      date: date || null,
      participants: cleanedParticipants,
      uploadedBy: "admin"
    });

    await activity.save();

    for (const participant of cleanedParticipants) {
      const { studentId } = participant;

      // FIX #6: Các tiêu chí có điều kiện phụ → dùng recompute đúng cách
      if (RECOMPUTE_CATEGORIES.includes(category)) {
        if (category === "hocTapTot") {
          await recomputeHocTapProgress(studentId);
        } else if (category === "tinhNguyenTot") {
          await recomputeTinhNguyenProgress(studentId);
        } else if (category === "hoiNhapTot") {
          await recomputeHoiNhapProgress(studentId);
        }
        continue;
      }

      // FIX #2: Kiểm tra null trước khi set để tránh crash với data cũ
      const student = await Student.findOne({ studentId });

      if (!student) continue;

      if (!student.sv5tProgress) {
        student.sv5tProgress = {};
      }

      if (!student.sv5tProgress[category]) {
        student.sv5tProgress[category] = {};
      }

      student.sv5tProgress[category].isCompleted = true;
      student.sv5tProgress[category].completedBy = "activity";
      student.sv5tProgress[category].completedAt = new Date();

      // FIX #5: Dùng hàm từ progressRecompute (có optional chaining an toàn)
      const completed = validCategories.filter(
        (cat) => student.sv5tProgress?.[cat]?.isCompleted
      ).length;

      student.totalCompletedCriteria = completed;
      student.progressPercent = Math.round((completed / 5) * 100);
      student.sv5tStatus =
        completed === 0 ? "not_started" : completed < 5 ? "in_progress" : "completed";

      await student.save();
    }

    res.json({
      success: true,
      message: "Tạo hoạt động thành công",
      activity
    });
  } catch (error) {
    console.error("Create activity error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo hoạt động"
    });
  }
});

// GET /api/activity/all
router.get("/all", requireAdminAuth, async (req, res) => {
  try {
    const activities = await Activity.find().sort({
      createdAt: -1
    });

    res.json({
      success: true,
      activities
    });
  } catch (error) {
    console.error("Get activities error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách hoạt động"
    });
  }
});

// GET /api/activity/student/:studentId
router.get("/student/:studentId", requireStudentAuth, async (req, res) => {
  try {
    const { studentId } = req.params;

    const activities = await Activity.find({
      "participants.studentId": studentId
    }).sort({
      date: -1
    });

    res.json({
      success: true,
      activities
    });
  } catch (error) {
    console.error("Get student activities error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy hoạt động của sinh viên"
    });
  }
});

module.exports = router;