const express = require("express");
const bcrypt = require("bcryptjs");
const Student = require("../Models/Student");
const jwt = require("jsonwebtoken");
const { requireStudentAuth } = require("../Middlewares/authMiddleware");

const { normalizeAwardLevel } = require("../Utils/sv5tLevels");

const {
  evaluateDaoDucSelfDeclare,
  evaluateHocTapMandatorySelfDeclare
} = require("../Utils/selfDeclareEvaluator");

const {
  hashResetCode,
  isResetCodeExpired
} = require("../Utils/resetPasswordUtils");

const ClassSupport = require("../Models/ClassSupport");
const globalSupport = require("../Utils/globalSupport");

const router = express.Router();

console.log("✅ StudentRoutes loaded");

// ===============================
// Helper: tạo JWT sinh viên
// ===============================
function createStudentToken(student) {
  return jwt.sign(
    {
      type: "student",
      studentId: student.studentId,
      fullName: student.fullName,
      className: student.className
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d"
    }
  );
}

// ===============================
// Helper: set cookie sinh viên
// ===============================
function setStudentCookie(res, token) {
  res.cookie("studentToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000
  });
}

// ===============================
// Helper: cập nhật tiến độ cấp Trường
// ===============================
function updateProgress(student) {
  const allCategories = [
    "daoDucTot",
    "hocTapTot",
    "theLucTot",
    "tinhNguyenTot",
    "hoiNhapTot"
  ];

  let completed = 0;

  allCategories.forEach((category) => {
    if (student.sv5tProgress?.[category]?.isCompleted === true) {
      completed += 1;
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

// ===============================
// Helper: ép boolean từ form/frontend
// ===============================
function normalizeBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "1";
}

// ===============================
// 1. KIỂM TRA MSSV
// ===============================
router.post("/check-mssv", async (req, res) => {
  try {
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập mã số sinh viên"
      });
    }

    const student = await Student.findOne({
      studentId: studentId.trim()
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy mã số sinh viên"
      });
    }

    res.json({
      success: true,
      studentId: student.studentId,
      fullName: student.fullName,
      className: student.className,
      hasPassword: !!student.password
    });
  } catch (error) {
    console.error("Check MSSV error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi kiểm tra MSSV"
    });
  }
});

// ===============================
// 2. TẠO MẬT KHẨU LẦN ĐẦU
// ===============================
router.post("/create-password", async (req, res) => {
  try {
    const { studentId, password, confirmPassword } = req.body;

    if (!studentId || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 6 ký tự"
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu nhập lại không khớp"
      });
    }

    const student = await Student.findOne({
      studentId: studentId.trim()
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên"
      });
    }

    if (student.password) {
      return res.status(400).json({
        success: false,
        message: "Tài khoản này đã có mật khẩu"
      });
    }

    student.password = await bcrypt.hash(password, 10);
    student.isActivated = true;
    student.lastLogin = new Date();

    await student.save();

    const token = createStudentToken(student);
    setStudentCookie(res, token);

    res.json({
      success: true,
      message: "Tạo mật khẩu thành công",
      student: {
        studentId: student.studentId,
        fullName: student.fullName,
        className: student.className
      }
    });
  } catch (error) {
    console.error("Create password error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo mật khẩu"
    });
  }
});

// ===============================
// 3. ĐĂNG NHẬP SINH VIÊN
// ===============================
router.post("/login", async (req, res) => {
  try {
    const { studentId, password } = req.body;

    if (!studentId || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập MSSV và mật khẩu"
      });
    }

    const student = await Student.findOne({
      studentId: studentId.trim()
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên"
      });
    }

    if (!student.password) {
      return res.status(400).json({
        success: false,
        message: "Tài khoản chưa tạo mật khẩu"
      });
    }

    const isMatch = await bcrypt.compare(password, student.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Sai mật khẩu"
      });
    }

    student.lastLogin = new Date();
    await student.save();

    const token = createStudentToken(student);
    setStudentCookie(res, token);

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      student: {
        studentId: student.studentId,
        fullName: student.fullName,
        className: student.className
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi đăng nhập"
    });
  }
});

// ===============================
// 4. RESET MẬT KHẨU
// ===============================
router.post("/reset-password", async (req, res) => {
  try {
    const {
      studentId,
      resetCode,
      newPassword,
      confirmPassword
    } = req.body;

    if (!studentId || !resetCode || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ MSSV, mã reset và mật khẩu mới"
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu nhập lại không khớp"
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự"
      });
    }

    const student = await Student.findOne({
      studentId: String(studentId).trim()
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên"
      });
    }

    if (
      !student.resetPasswordCodeHash ||
      !student.resetPasswordExpiresAt ||
      student.resetPasswordUsed
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã reset không tồn tại hoặc đã được sử dụng. Vui lòng liên hệ admin lớp để lấy mã mới."
      });
    }

    if (isResetCodeExpired(student.resetPasswordExpiresAt)) {
      return res.status(400).json({
        success: false,
        message: "Mã reset đã hết hạn. Vui lòng liên hệ admin lớp để lấy mã mới."
      });
    }

    const inputCodeHash = hashResetCode(String(resetCode).trim());

    if (inputCodeHash !== student.resetPasswordCodeHash) {
      return res.status(400).json({
        success: false,
        message: "Mã reset không chính xác"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    student.password = hashedPassword;
    student.resetPasswordCodeHash = "";
    student.resetPasswordExpiresAt = null;
    student.resetPasswordUsed = true;

    await student.save();

    return res.json({
      success: true,
      message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại."
    });
  } catch (error) {
    console.error("Student reset password error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi đặt lại mật khẩu"
    });
  }
});


// ===============================
// 5. TỰ KHAI ĐẠO ĐỨC TỐT
// Hệ thống tự so điều kiện theo cấp: truong / dhqg / thanh
// Không tạo Evidence, không cần admin duyệt
// ===============================
router.post("/declare/dao-duc", requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.studentId;
    const awardLevel = normalizeAwardLevel(req.body.awardLevel);

    const student = await Student.findOne({ studentId });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên"
      });
    }

    const trainingScore =
      req.body.trainingScore !== undefined
        ? req.body.trainingScore
        : req.body.diemRenLuyen;

    const noLawViolation =
      req.body.noLawViolation !== undefined
        ? normalizeBoolean(req.body.noLawViolation)
        : normalizeBoolean(req.body.khongViPham);

    const noRuleViolation =
      req.body.noRuleViolation !== undefined
        ? normalizeBoolean(req.body.noRuleViolation)
        : normalizeBoolean(req.body.khongViPham);

    const excellentUnionMember =
      req.body.excellentUnionMember !== undefined
        ? normalizeBoolean(req.body.excellentUnionMember)
        : req.body.danhGiaDoanVien === "hoan_thanh_xuat_sac";

    const declareData = {
      trainingScore,
      noLawViolation,
      noRuleViolation,
      excellentUnionMember
    };

    const result = evaluateDaoDucSelfDeclare(awardLevel, declareData);

    student.selfDeclarations = (student.selfDeclarations || []).filter(
      (item) => {
        return !(
          item.awardLevel === awardLevel &&
          item.category === "daoDucTot"
        );
      }
    );

    student.selfDeclarations.push({
      awardLevel,
      category: "daoDucTot",
      data: declareData,
      isCompleted: result.isCompleted,
      reason: result.reason,
      evaluatedBy: "system",
      declaredAt: new Date()
    });

    // Dashboard hiện tại vẫn là cấp Trường
    if (awardLevel === "truong") {
      student.sv5tProgress.daoDucTot.isCompleted = result.isCompleted;
      student.sv5tProgress.daoDucTot.completedBy = result.isCompleted
        ? "system"
        : "none";
      student.sv5tProgress.daoDucTot.completedAt = result.isCompleted
        ? new Date()
        : null;

      updateProgress(student);
    }

    await student.save();

    res.json({
      success: true,
      awardLevel,
      category: "daoDucTot",
      isCompleted: result.isCompleted,
      reason: result.reason,
      message: result.reason
    });
  } catch (error) {
    console.error("Declare dao duc error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi tự khai Đạo đức tốt"
    });
  }
});

// ===============================
// 6. TỰ KHAI HỌC TẬP BẮT BUỘC / GPA
// Hệ thống tự so điều kiện theo cấp
// Học tập tốt chỉ hoàn thành khi mandatoryPassed + extraPassed
// ===============================
router.post("/declare/hoc-tap", requireStudentAuth, async (req, res) => {
  try {
    const studentId = req.student.studentId;
    const awardLevel = normalizeAwardLevel(req.body.awardLevel);

    const student = await Student.findOne({ studentId });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên"
      });
    }

    const gpaScale =
      req.body.gpaScale !== undefined
        ? String(req.body.gpaScale)
        : String(req.body.thangDiem || "4");

    const gpaValue =
      req.body.gpaValue !== undefined ? req.body.gpaValue : req.body.gpa;

    const studentType = req.body.studentType || "university";

    const properLearningAttitude =
      req.body.properLearningAttitude !== undefined
        ? normalizeBoolean(req.body.properLearningAttitude)
        : normalizeBoolean(req.body.thaiDoHocTapDungDan);

    const noAcademicViolation =
      req.body.noAcademicViolation !== undefined
        ? normalizeBoolean(req.body.noAcademicViolation)
        : normalizeBoolean(req.body.khongGianLan);

    const noFailedSubjects =
      req.body.noFailedSubjects !== undefined
        ? normalizeBoolean(req.body.noFailedSubjects)
        : normalizeBoolean(req.body.khongNoMon);

    const declareData = {
      gpaScale,
      gpaValue,
      studentType,
      properLearningAttitude,
      noAcademicViolation,
      noFailedSubjects
    };

    const result = evaluateHocTapMandatorySelfDeclare(
      awardLevel,
      declareData
    );

    student.selfDeclarations = (student.selfDeclarations || []).filter(
      (item) => {
        return !(
          item.awardLevel === awardLevel &&
          item.category === "hocTapTot"
        );
      }
    );

    student.selfDeclarations.push({
      awardLevel,
      category: "hocTapTot",
      data: declareData,
      isCompleted: result.isCompleted,
      reason: result.reason,
      evaluatedBy: "system",
      declaredAt: new Date()
    });

    // Dashboard hiện tại vẫn là cấp Trường
    if (awardLevel === "truong") {
      const hocTap = student.sv5tProgress.hocTapTot;

      hocTap.mandatoryPassed = result.isCompleted;
      hocTap.mandatoryCompletedAt = result.isCompleted ? new Date() : null;

      if (hocTap.mandatoryPassed && hocTap.extraPassed) {
        hocTap.isCompleted = true;
        hocTap.completedBy = "student_declare_and_evidence";
        hocTap.completedAt = new Date();
      } else {
        hocTap.isCompleted = false;
        hocTap.completedBy = "none";
        hocTap.completedAt = null;
      }

      updateProgress(student);
    }

    await student.save();

    res.json({
      success: true,
      awardLevel,
      category: "hocTapTot",
      isCompleted: result.isCompleted,
      gpaPassed: result.gpaPassed,
      requiredText: result.requiredText,
      reason: result.reason,
      message: result.reason
    });
  } catch (error) {
    console.error("Declare hoc tap error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi tự khai Học tập tốt"
    });
  }
});

// ===============================
// 7. LẤY THÔNG TIN SINH VIÊN ĐANG ĐĂNG NHẬP
// ===============================
router.get("/me", (req, res) => {
  try {
    const token = req.cookies.studentToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "student") {
      return res.status(403).json({
        success: false,
        message: "Token không hợp lệ"
      });
    }

    res.json({
      success: true,
      student: {
        studentId: decoded.studentId,
        fullName: decoded.fullName,
        className: decoded.className
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn"
    });
  }
});

// ===============================
// 8. ĐĂNG XUẤT SINH VIÊN
// ===============================
router.post("/logout", (req, res) => {
  res.clearCookie("studentToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  });

  res.json({
    success: true,
    message: "Đăng xuất sinh viên thành công"
  });
});

console.log(
  "StudentRoutes registered paths:",
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods)
    }))
);

// ===============================
// 9. LẤY THÔNG TIN HỖ TRỢ LIÊN HỆ
// ===============================

router.get("/support-contact", requireStudentAuth, async (req, res) => {
  try {
    const student = await Student.findOne({
      studentId: req.student.studentId
    }).select("studentId fullName className");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sinh viên"
      });
    }

    const classSupport = await ClassSupport.findOne({
      className: student.className
    });

    return res.json({
      success: true,
      student: {
        studentId: student.studentId,
        fullName: student.fullName,
        className: student.className
      },
      support: {
        global: globalSupport,
        classSupport: classSupport || null
      }
    });
  } catch (error) {
    console.error("Get support contact error:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thông tin hỗ trợ"
    });
  }
});

module.exports = router;