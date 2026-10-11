// controllers/evidenceController.js
// Xử lý request/response cho luồng minh chứng của sinh viên: upload, xem trạng
// thái, xem danh sách. Nghiệp vụ AI nằm ở services/aiService.js, lưu trữ R2 nằm
// ở services/storageService.js, phát hiện ảnh chỉnh sửa nằm ở Utils/forensicsAnalysis.js.

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Evidence = require("../Models/Evidence");
const Student = require("../Models/Student");

const {
  recomputeHocTapProgress,
  recomputeTinhNguyenProgress,
  recomputeHoiNhapProgress
} = require("../Utils/progressRecompute");

const {
  normalizeAwardLevel,
  getAwardLevelLabel,
  isHigherAwardLevel
} = require("../Utils/sv5tLevels");

const { containsMockTestKeyword } = require("../Utils/aiPrompts/index");

const {
  buildStudentContext,
  normalizeAiV2Result,
  applyAiSafetyRules
} = require("../Utils/aiDecisionEngine");

const { sendPushToAdminsForClass } = require("../Utils/pushService");
const { verifyEvidenceQR } = require("../Utils/qrVerification");
const { analyzeImageForensics } = require("../Utils/forensicsAnalysis");
const { callAzureOpenAI } = require("../Utils/azureAI");

const {
  isStudentIdentityConfirmed,
  getEmptyAiResult,
  normalizeAiResult,
  createAIReviewLog,
  analyzeEvidenceWithAI
} = require("../services/aiService");

const {
  safeArchiveEvidenceToR2,
  getEvidenceFileUrl
} = require("../services/storageService");

// ─────────────────────────────────────────
// 1. CẤU HÌNH MULTER
// ─────────────────────────────────────────

const allowedMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg"
];

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

const TEMP_UPLOAD_DIR = "uploads/evidence-temp/";

if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, {
    recursive: true
  });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, TEMP_UPLOAD_DIR);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: function (req, file, cb) {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file PDF, DOC, DOCX, PNG, JPG hoặc JPEG"));
    }
  }
});

function uploadEvidenceMiddleware(req, res, next) {
  const handler = upload.single("evidence");

  handler(req, res, function (err) {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File vượt quá 2 MB. Vui lòng chọn file nhỏ hơn."
        });
      }

      return res.status(400).json({
        success: false,
        message: err.message || "File upload không hợp lệ"
      });
    }

    next();
  });
}

// ─────────────────────────────────────────
// 2. HẰNG SỐ
// ─────────────────────────────────────────

const categoryLabels = {
  daoDucTot: "Đạo đức tốt",
  hocTapTot: "Học tập tốt",
  theLucTot: "Thể lực tốt",
  tinhNguyenTot: "Tình nguyện tốt",
  hoiNhapTot: "Hội nhập tốt",
  khac: "Khác"
};

// Tiêu chí tự khai, không nên upload minh chứng qua route này
const SELF_DECLARE_CATEGORIES = ["daoDucTot"];

// ─────────────────────────────────────────
// 3. QUYẾT ĐỊNH TRẠNG THÁI MINH CHỨNG SAU KHI AI PHÂN TÍCH
// ─────────────────────────────────────────

async function updateStudentProgress(studentId, category) {
  try {
    const student = await Student.findOne({
      studentId
    });

    if (!student || !student.sv5tProgress?.[category]) return;

    const progress = student.sv5tProgress[category];

    const previousCompletedBy = progress.completedBy || "none";

    progress.isCompleted = true;

    if (!progress.completedAt) {
      progress.completedAt = new Date();
    }

    if (
      previousCompletedBy === "activity" ||
      previousCompletedBy === "admin"
    ) {
      progress.completedBy = "activity_and_evidence";
    } else if (
      previousCompletedBy === "student_declare" ||
      previousCompletedBy === "student_declare_and_evidence"
    ) {
      progress.completedBy = "student_declare_and_evidence";
    } else if (
      previousCompletedBy === "activity_and_evidence"
    ) {
      progress.completedBy = "activity_and_evidence";
    } else {
      progress.completedBy = "evidence";
    }

    const allCategories = [
      "daoDucTot",
      "hocTapTot",
      "theLucTot",
      "tinhNguyenTot",
      "hoiNhapTot"
    ];

    let completed = 0;

    allCategories.forEach((c) => {
      if (student.sv5tProgress[c]?.isCompleted) {
        completed += 1;
      }
    });

    student.totalCompletedCriteria = completed;
    student.progressPercent = Math.round((completed / 5) * 100);

    student.sv5tStatus =
      completed === 0
        ? "not_started"
        : completed < 5
        ? "in_progress"
        : "completed";

    await student.save();
  } catch (error) {
    console.error("updateStudentProgress error:", error.message);
  }
}

async function handleSchoolLevelAiResult({
  evidence,
  aiResult,
  studentId,
  category
}) {
  if (category === "hocTapTot") {
    if (aiResult.isValid === true && aiResult.confidence >= 70 && isStudentIdentityConfirmed(aiResult)) {
      evidence.status = "ai_valid";
      await evidence.save();

      await safeArchiveEvidenceToR2(evidence);
      await recomputeHocTapProgress(studentId);
      return;
    }

    if (aiResult.isValid === null && aiResult.confidence >= 70 && isStudentIdentityConfirmed(aiResult)) {
      const type = aiResult.academicEvidenceType || "";
      const count = Number(aiResult.academicActivityCount || 0);

      if (type === "hocThuat_3_activities" && count > 0) {
        evidence.status = "partial_valid";
        await evidence.save();

        await safeArchiveEvidenceToR2(evidence);
        await recomputeHocTapProgress(studentId);
        return;
      }
    }

    if (aiResult.isValid === false) {
      evidence.status = "ai_invalid";
      await evidence.save();
      return;
    }

    evidence.status = "manual_review";
    await evidence.save();
    return;
  }

  if (category === "tinhNguyenTot") {
    const volunteerDays = Number(aiResult.volunteerDays || 0);
    const matchedType = aiResult.matchedType || "";

    const isAward =
      aiResult.hasVolunteerAward === true ||
      matchedType.toLowerCase().includes("giấy khen") ||
      matchedType.toLowerCase().includes("khen thưởng");

    evidence.aiResult.volunteerDays = volunteerDays;
    evidence.aiResult.volunteerActivityName =
      aiResult.volunteerActivityName || "";
    evidence.aiResult.hasVolunteerAward = isAward;

    if ((volunteerDays > 0 || isAward) && aiResult.confidence >= 70 && isStudentIdentityConfirmed(aiResult)) {
      evidence.status =
        isAward || volunteerDays >= 5 ? "ai_valid" : "partial_valid";

      await evidence.save();
      await safeArchiveEvidenceToR2(evidence);
      await recomputeTinhNguyenProgress(studentId);
      return;
    }

    if (aiResult.isValid === false) {
      evidence.status = "ai_invalid";
      await evidence.save();
      return;
    }

    evidence.status = "manual_review";
    await evidence.save();
    return;
  }

  if (category === "hoiNhapTot") {
    const subCriteria = aiResult.subCriteria || "";

    if (
      aiResult.isValid === true &&
      aiResult.confidence >= 70 &&
      isStudentIdentityConfirmed(aiResult) &&
      ["ngoaiNgu", "kyNang", "hoiNhap"].includes(subCriteria)
    ) {
      evidence.status = "ai_valid";
      evidence.aiResult.subCriteria = subCriteria;

      await evidence.save();
      await safeArchiveEvidenceToR2(evidence);
      await recomputeHoiNhapProgress(studentId);
      return;
    }

    if (aiResult.isValid === false) {
      evidence.status = "ai_invalid";
      await evidence.save();
      return;
    }

    evidence.status = "manual_review";
    await evidence.save();
    return;
  }

  if (aiResult.isValid === true && aiResult.confidence >= 70 && isStudentIdentityConfirmed(aiResult)) {
    evidence.status = "ai_valid";
    await evidence.save();

    await safeArchiveEvidenceToR2(evidence);
    await updateStudentProgress(studentId, category);
    return;
  }

  if (aiResult.isValid === false) {
    evidence.status = "ai_invalid";
    await evidence.save();
    return;
  }

  evidence.status = "manual_review";
  await evidence.save();
}

async function handleOtherSv5tAiResult({
  evidence,
  aiResult
}) {
  evidence.aiResult = {
    ...evidence.aiResult,
    ...aiResult,
    sv5tHistoryType:
      aiResult.sv5tHistoryType ||
      aiResult.matchedType ||
      "",
    reason:
      aiResult.reason ||
      "AI đã phân tích minh chứng SV5T các năm trước. Cần admin kiểm tra nếu thông tin chưa rõ."
  };

  const confidence = Number(aiResult.confidence || 0);

  if (aiResult.isValid === true && confidence >= 70 && isStudentIdentityConfirmed(aiResult)) {
    evidence.status = "ai_valid";

    await evidence.save();
    await safeArchiveEvidenceToR2(evidence);
    return;
  }

  if (aiResult.isValid === false && confidence >= 80) {
    evidence.status = "ai_invalid";

    await evidence.save();
    return;
  }

  evidence.status = "manual_review";

  await evidence.save();
}

async function handleHigherLevelAiResult({ evidence, aiResult, awardLevel }) {
  evidence.status = "manual_review";

  evidence.aiResult = {
    ...evidence.aiResult,
    ...aiResult,
    reason:
      `${aiResult.reason || "AI đã phân tích minh chứng."} ` +
      `Đây là minh chứng xét ${getAwardLevelLabel(awardLevel)}, nên cần admin duyệt chính thức trước khi được tính vào tiến độ.`
  };

  await evidence.save();
}

// ─────────────────────────────────────────
// 4. ROUTE HANDLERS
// ─────────────────────────────────────────

async function testAzureConnection(req, res) {
  try {
    const reply = await callAzureOpenAI({
      system: "Bạn là trợ lý kiểm tra kết nối.",
      messages: [{ role: "user", content: "Trả lời đúng JSON: {\"success\":true,\"message\":\"Azure OpenAI hoạt động\"}" }],
      maxTokens: 100,
      temperature: 0
    });

    res.json({
      success: true,
      message: "Kết nối Azure OpenAI API thành công",
      reply
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không gọi được Azure OpenAI API",
      error: error.message
    });
  }
}

async function uploadEvidence(req, res) {
  try {
    const studentId = req.student.studentId;
    const { category } = req.body;
    const awardLevel = normalizeAwardLevel(req.body.awardLevel || "truong");

    if (!studentId || !category) {
      return res.status(400).json({
        success: false,
        message: "Thiếu MSSV hoặc tiêu chí"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn file minh chứng"
      });
    }

    if (SELF_DECLARE_CATEGORIES.includes(category)) {
      const evidence = new Evidence({
        studentId,
        category,
        awardLevel,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileKey: "",
        fileUrl: "",
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        storageStatus: "local_temp",
        status: "manual_review",
        aiResult: getEmptyAiResult(
          `Tiêu chí "${categoryLabels[category]}" thuộc "${getAwardLevelLabel(awardLevel)}" do sinh viên tự khai báo. Minh chứng này cần admin xem xét nếu đơn vị yêu cầu.`
        )
      });

      await evidence.save();

      return res.json({
        success: true,
        message: `Đã lưu minh chứng "${categoryLabels[category]}". Admin sẽ xem xét và xác nhận nếu cần.`,
        evidence,
        aiProcessed: false
      });
    }

    const evidence = new Evidence({
      studentId,
      category,
      awardLevel,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileKey: "",
      fileUrl: "",
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      storageStatus: "local_temp",
      status: "pending",
      aiResult: getEmptyAiResult("")
    });

    await evidence.save();

    const uploadStudent = await Student.findOne({
      studentId
    }).select("studentId fullName className");
    const studentContext = buildStudentContext(uploadStudent || req.student);

    sendPushToAdminsForClass(
      uploadStudent?.className || req.student.className || "",
      {
        title: "Có minh chứng mới cần xử lý",
        body: `${uploadStudent?.fullName || studentId} vừa upload minh chứng ${categoryLabels[category] || category}.`,
        url: "/admin-dashboard.html"
      }
    ).catch((error) => {
      console.error("Push new evidence to admin error:", error.message);
    });

    // Start QR verification in parallel with AI (images only)
    const isImageEvidence =
      req.file.mimetype === "image/png" || req.file.mimetype === "image/jpeg";
    const qrPromise = isImageEvidence
      ? verifyEvidenceQR(req.file.path, uploadStudent).catch((e) => {
          console.error("QR verification error:", e.message);
          return null;
        })
      : Promise.resolve(null);

    // Phát hiện ảnh bị chỉnh sửa (ELA + AI thị giác), chạy song song với AI đánh giá minh chứng.
    const forensicsPromise = isImageEvidence
      ? analyzeImageForensics(req.file.path, req.file.mimetype).catch((e) => {
          console.error("Forensics analysis error:", e.message);
          return null;
        })
      : Promise.resolve(null);

    analyzeEvidenceWithAI(
      req.file.path,
      req.file.mimetype,
      category,
      awardLevel,
      studentContext
    )
      .then(async (rawAiResult) => {
        const rawResponse = rawAiResult?.rawResponse || "";

        let aiResult = normalizeAiResult(rawAiResult);

        aiResult = normalizeAiV2Result(
          aiResult,
          category,
          awardLevel,
          studentContext
        );

        aiResult = applyAiSafetyRules(aiResult, category);

        delete aiResult.rawResponse;
        delete aiResult._studentContext;
        delete aiResult._awardLevel;

        if (
          awardLevel === "dhqg" &&
          category === "hoiNhapTot" &&
          aiResult.subCriteria === "ngoaiNgu"
        ) {
          const textForMockCheck = [
            aiResult.extractedText,
            aiResult.reason,
            aiResult.matchedType,
            ...(aiResult.matchedEvidence || [])
          ].join(" ");

          if (containsMockTestKeyword(textForMockCheck)) {
            aiResult.isValid = false;
            aiResult.confidence = Math.max(Number(aiResult.confidence || 0), 85);
            aiResult.missingInfo = [
              ...(aiResult.missingInfo || []),
              "Cấp ĐHQG-HCM không chấp nhận chứng nhận trong các đợt thi thử."
            ];
            aiResult.reason =
              "Minh chứng thuộc nhóm Ngoại ngữ nhưng có dấu hiệu là chứng nhận/kết quả thi thử. Theo quy chế cấp ĐHQG-HCM, không chấp nhận chứng nhận trong các đợt thi thử.";
          }
        }

        // Apply QR verification boost (runs parallel with AI, await result here)
        const qrResult = await qrPromise;
        if (qrResult) {
          evidence.qrVerification = qrResult;

          if (qrResult.studentNameFound || qrResult.studentIdFound) {
            const existingConf = Number(aiResult.confidence || 0);
            // Don't override high-confidence safety rejections (e.g. mock-test block at ≥85%)
            if (aiResult.isValid !== false || existingConf < 85) {
              if (aiResult.isValid === false) {
                aiResult.isValid = true;
                aiResult.confidence = Math.max(existingConf, 80);
              } else {
                aiResult.confidence = Math.min(100, existingConf + 15);
              }
              aiResult.reason =
                (aiResult.reason ? aiResult.reason + " " : "") +
                "[QR xác nhận: Sinh viên có trong Quyết định công nhận chính thức]";
            }
            console.log(
              `🔍 QR Verified [${studentId}]: name=${qrResult.studentNameFound} id=${qrResult.studentIdFound} file="${qrResult.pdfFileName}"`
            );
          } else if (qrResult.hasQR && !qrResult.error) {
            aiResult.warningFlags = [
              ...(aiResult.warningFlags || []),
              "QR code tìm thấy nhưng tên sinh viên không có trong Quyết định công nhận"
            ];
            console.log(
              `⚠️ QR found but student not in PDF [${studentId}]: ${qrResult.pdfFileName}`
            );
          } else if (qrResult.hasQR && qrResult.error) {
            console.log(`⚠️ QR error [${studentId}]: ${qrResult.error}`);
          }
        }

        const forensicsResult = await forensicsPromise;
        if (forensicsResult) {
          evidence.forensics = forensicsResult;

          if (forensicsResult.suspected) {
            aiResult.warningFlags = [
              ...(aiResult.warningFlags || []),
              "forensics_forgery_suspected",
              ...(forensicsResult.warningFlags || [])
            ];
            aiResult.missingInfo = [
              ...(aiResult.missingInfo || []),
              `Hệ thống phát hiện ảnh có dấu hiệu chỉnh sửa (điểm nghi vấn ${forensicsResult.forgeryScore}/100). Cần admin kiểm tra kỹ trước khi duyệt.`
            ];
            aiResult.reason =
              (aiResult.reason ? aiResult.reason + " " : "") +
              "[Cảnh báo forensics: ảnh có dấu hiệu chỉnh sửa (Photoshop/Canva/AI), cần admin kiểm tra thủ công.]";

            console.log(
              `🚩 Forensics suspected [${studentId}]: forgeryScore=${forensicsResult.forgeryScore} ela=${forensicsResult.elaScore} ai=${forensicsResult.aiForgeryScore}`
            );
          }
        }

        evidence.aiResult = aiResult;
        await createAIReviewLog({
          studentId,
          evidenceId: evidence._id,
          category,
          awardLevel,
          inputType: req.file.mimetype,
          extractedTextLength: String(aiResult.extractedText || "").length,
          statusBefore: "pending",
          rawResponse,
          parsedResult: aiResult
        });

        // BẮT BUỘC: Nếu forensics nghi vấn ảnh bị chỉnh sửa, không để AI tự động
        // duyệt (ai_valid/partial_valid) dưới bất kỳ hình thức nào — luôn chuyển
        // cho admin kiểm tra thủ công trước, bất kể category/awardLevel.
        if (forensicsResult?.suspected) {
          evidence.status = "manual_review";
          await evidence.save();

          console.log(
            `🚩 AI Forensics [${studentId}/${category}/${awardLevel}]: manual_review (forgeryScore=${forensicsResult.forgeryScore}) — ${aiResult.reason}`
          );

          return;
        }

        if (category === "khac") {
          await handleOtherSv5tAiResult({
            evidence,
            aiResult
          });

          console.log(
            `📌 AI Khác [${studentId}/${category}/${awardLevel}]: ${evidence.status} (${aiResult.confidence}%) — ${aiResult.reason}`
          );

          return;
        }

        if (isHigherAwardLevel(awardLevel)) {
          await handleHigherLevelAiResult({
            evidence,
            aiResult,
            awardLevel
          });

          console.log(
            `🟡 AI đề xuất [${studentId}/${category}/${awardLevel}]: manual_review (${aiResult.confidence}%) — ${aiResult.reason}`
          );

          return;
        }

        await handleSchoolLevelAiResult({
          evidence,
          aiResult,
          studentId,
          category
        });

        await createAIReviewLog({
          studentId,
          evidenceId: evidence._id,
          category,
          awardLevel,
          inputType: req.file.mimetype,
          extractedTextLength: String(aiResult.extractedText || "").length,
          statusBefore: "pending",
          statusAfter: evidence.status,
          parsedResult: aiResult
        });

        console.log(
          `✅ AI [${studentId}/${category}/${awardLevel}]: ${evidence.status} (${aiResult.confidence}%) — ${aiResult.reason}`
        );
      })
      .catch(async (error) => {
        console.error("Background AI error:", error.message);

        evidence.status = "manual_review";
        evidence.aiResult = getEmptyAiResult(
          "Có lỗi khi chạy AI. Cần admin kiểm tra thủ công."
        );
        evidence.aiResult.missingInfo = [error.message];

        await evidence.save();
        await createAIReviewLog({
          studentId,
          evidenceId: evidence._id,
          category,
          awardLevel,
          inputType: req.file?.mimetype || "",
          statusBefore: "pending",
          statusAfter: "manual_review",
          errorMessage: error.message
        });
      });

    res.json({
      success: true,
      message:
        category === "khac"
          ? "Upload thành công. AI đang kiểm tra minh chứng danh hiệu Sinh viên 5 tốt các năm trước, kết quả cập nhật sau vài giây."
          : `Upload thành công. AI đang kiểm tra minh chứng theo quy chế ${getAwardLevelLabel(awardLevel)}, kết quả cập nhật sau vài giây.`,
      evidence,
      aiProcessed: true
    });
  } catch (error) {
    console.error("Upload evidence error:", error);

    // Xóa file tạm nếu có lỗi
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error("Không xóa được file tạm:", unlinkErr.message);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || "Lỗi server khi upload minh chứng"
    });
  }
}

async function getStudentEvidences(req, res) {
  const { studentId } = req.params;
  const awardLevel = req.query.awardLevel
    ? normalizeAwardLevel(req.query.awardLevel)
    : null;

  if (req.student.studentId !== studentId) {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền xem minh chứng của sinh viên khác"
    });
  }

  try {
    const query = {
      studentId
    };

    if (awardLevel) {
      query.awardLevel = awardLevel;
    }

    const evidences = await Evidence.find(query).sort({
      createdAt: -1
    });

    const evidencesWithFileUrl = await Promise.all(
      evidences.map(async (evidence) => {
        const plain = evidence.toObject();
        plain.fileUrl = await getEvidenceFileUrl(evidence);
        return plain;
      })
    );

    res.json({
      success: true,
      evidences: evidencesWithFileUrl
    });
  } catch (error) {
    console.error("Get student evidences error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách minh chứng"
    });
  }
}

async function getEvidenceStatus(req, res) {
  try {
    const { evidenceId } = req.params;

    const evidence = await Evidence.findById(evidenceId);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy minh chứng"
      });
    }

    if (evidence.studentId !== req.student.studentId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem minh chứng này"
      });
    }

    const fileUrl = await getEvidenceFileUrl(evidence);

    res.json({
      success: true,
      evidence: {
        _id: evidence._id,
        studentId: evidence.studentId,
        awardLevel: evidence.awardLevel,
        category: evidence.category,
        fileName: evidence.fileName,
        fileUrl,
        fileKey: evidence.fileKey,
        fileSize: evidence.fileSize,
        fileType: evidence.fileType,
        storageStatus: evidence.storageStatus,
        status: evidence.status,
        aiResult: evidence.aiResult,
        createdAt: evidence.createdAt,
        updatedAt: evidence.updatedAt
      }
    });
  } catch (error) {
    console.error("Get evidence status error:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server khi kiểm tra trạng thái minh chứng"
    });
  }
}

module.exports = {
  uploadEvidenceMiddleware,
  testAzureConnection,
  uploadEvidence,
  getStudentEvidences,
  getEvidenceStatus
};
