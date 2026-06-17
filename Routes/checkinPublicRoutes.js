const express = require("express");
const router = express.Router();
const CheckinSession = require("../Models/CheckinSession");
const Student = require("../Models/Student");

// Tìm session bằng mã bảo mật (public — không cần đăng nhập)
router.get("/by-code/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: "Mã bảo mật không hợp lệ" });
    }

    const session = await CheckinSession.findOne({ securityCode: code })
      .select("title description createdAt checkins")
      .lean();

    if (!session) {
      return res.status(404).json({ success: false, message: "Không tìm thấy phiên với mã này" });
    }

    return res.json({
      success: true,
      session: {
        _id: session._id,
        title: session.title,
        description: session.description,
        createdAt: session.createdAt,
        checkinCount: session.checkins.length
      }
    });
  } catch (error) {
    console.error("Volunteer lookup error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
});

// Ghi nhận check-in qua mã bảo mật (public — mã là xác thực duy nhất)
router.post("/by-code/:code/scan", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const { studentId } = req.body;

    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: "Mã bảo mật không hợp lệ" });
    }

    if (!studentId?.trim()) {
      return res.status(400).json({ success: false, message: "Thiếu MSSV" });
    }

    const session = await CheckinSession.findOne({ securityCode: code });

    if (!session) {
      return res.status(404).json({ success: false, message: "Mã bảo mật không hợp lệ hoặc phiên đã bị xóa" });
    }

    const alreadyIn = session.checkins.some((c) => c.studentId === studentId.trim());
    if (alreadyIn) {
      return res.status(409).json({
        success: false,
        message: `Sinh viên ${studentId} đã check-in trong phiên này rồi`
      });
    }

    const student = await Student.findOne({ studentId: studentId.trim() })
      .select("studentId fullName className")
      .lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy sinh viên với MSSV ${studentId}`
      });
    }

    const record = {
      studentId: student.studentId,
      fullName: student.fullName,
      className: student.className,
      checkinAt: new Date()
    };

    session.checkins.push(record);
    await session.save();

    return res.json({ success: true, checkin: record });
  } catch (error) {
    console.error("Volunteer checkin error:", error);
    return res.status(500).json({ success: false, message: "Lỗi server khi ghi nhận check-in" });
  }
});

module.exports = router;
