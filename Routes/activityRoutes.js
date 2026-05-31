const express = require("express");
const Activity = require("../Models/Activity");
const Student = require("../Models/Student");

const router = express.Router();

const validCategories = [
  "daoDucTot",
  "hocTapTot",
  "theLucTot",
  "tinhNguyenTot",
  "hoiNhapTot"
];

// POST /api/activity/create
router.post("/create", async (req, res) => {
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
      const student = await Student.findOne({
        studentId: participant.studentId
      });

      if (student && student.sv5tProgress && student.sv5tProgress[category]) {
        student.sv5tProgress[category].isCompleted = true;
        student.sv5tProgress[category].completedBy = "activity";
        student.sv5tProgress[category].completedAt = new Date();

        updateStudentProgressSummary(student);

        await student.save();
      }
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
router.get("/all", async (req, res) => {
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
router.get("/student/:studentId", async (req, res) => {
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

function updateStudentProgressSummary(student) {
  const categories = [
    "daoDucTot",
    "hocTapTot",
    "theLucTot",
    "tinhNguyenTot",
    "hoiNhapTot"
  ];

  let completed = 0;

  categories.forEach((category) => {
    if (student.sv5tProgress[category].isCompleted) {
      completed++;
    }
  });

  student.totalCompletedCriteria = completed;
  student.progressPercent = Math.round((completed / 5) * 100);

  if (completed === 0) {
    student.sv5tStatus = "not_started";
  } else if (completed < 5) {
    student.sv5tStatus = "in_progress";
  } else {
    student.sv5tStatus = "completed";
  }
}

module.exports = router;