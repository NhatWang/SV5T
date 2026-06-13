const express = require("express");
const PushSubscription = require("../Models/PushSubscription");

const {
  requireStudentAuth,
  requireAdminAuth
} = require("../Middlewares/authMiddleware");

const router = express.Router();

router.get("/public-key", (req, res) => {
  res.json({
    success: true,
    publicKey: process.env.VAPID_PUBLIC_KEY || ""
  });
});

router.post("/student/subscribe", requireStudentAuth, async (req, res) => {
  try {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin push subscription."
      });
    }

    await PushSubscription.findOneAndUpdate(
      {
        endpoint: subscription.endpoint
      },
      {
        targetType: "student",
        targetId: req.student.studentId,
        role: "student",
        className: req.student.className || "",
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        },
        userAgent: req.headers["user-agent"] || ""
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    res.json({
      success: true,
      message: "Đã bật thông báo cho sinh viên."
    });
  } catch (error) {
    console.error("Student push subscribe error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi đăng ký thông báo."
    });
  }
});

router.post("/admin/subscribe", requireAdminAuth, async (req, res) => {
  try {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin push subscription."
      });
    }

    await PushSubscription.findOneAndUpdate(
      {
        endpoint: subscription.endpoint
      },
      {
        targetType: "admin",
        targetId: req.admin.username,
        role: req.admin.role,
        className: req.admin.className || "",
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        },
        userAgent: req.headers["user-agent"] || ""
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    res.json({
      success: true,
      message: "Đã bật thông báo cho admin."
    });
  } catch (error) {
    console.error("Admin push subscribe error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi đăng ký thông báo."
    });
  }
});

module.exports = router;