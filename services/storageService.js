// services/storageService.js
// Lớp orchestration lưu trữ minh chứng: đẩy file tạm lên Cloudflare R2, cập nhật
// document Evidence tương ứng, và xử lý an toàn khi việc lưu trữ thất bại.
// Các thao tác S3/R2 thuần túy (upload/xóa/presign theo key) nằm ở Utils/r2Client.js.

const fs = require("fs");

const {
  buildEvidenceKey,
  uploadLocalFileToR2,
  deleteFromR2,
  getEvidenceFileUrl
} = require("../Utils/r2Client");

async function archiveEvidenceToR2(evidence) {
  if (!evidence) return null;

  if (evidence.storageStatus === "r2_archived" && evidence.fileUrl) {
    return evidence;
  }

  if (!evidence.filePath || !fs.existsSync(evidence.filePath)) {
    evidence.storageStatus = "none";
    await evidence.save();
    return evidence;
  }

  const fileKey = buildEvidenceKey(evidence.studentId, evidence.fileName);

  const uploadedFile = await uploadLocalFileToR2({
    localPath: evidence.filePath,
    key: fileKey,
    contentType: evidence.fileType
  });

  evidence.fileKey = uploadedFile.key;
  evidence.fileUrl = uploadedFile.url;
  evidence.storageStatus = "r2_archived";

  if (fs.existsSync(evidence.filePath)) {
    fs.unlinkSync(evidence.filePath);
  }

  evidence.filePath = "";

  await evidence.save();

  return evidence;
}

async function safeArchiveEvidenceToR2(evidence) {
  try {
    return await archiveEvidenceToR2(evidence);
  } catch (error) {
    console.error("Archive evidence to R2 error:", error.message);

    if (!evidence) return null;

    const currentAiResult = evidence.aiResult || {};

    const currentMissingInfo = Array.isArray(currentAiResult.missingInfo)
      ? currentAiResult.missingInfo
      : [];

    const currentWarningFlags = Array.isArray(currentAiResult.warningFlags)
      ? currentAiResult.warningFlags
      : [];

    const safeExtractedInfo = currentAiResult.extractedInfo || {
      studentName: "",
      studentId: "",
      className: "",
      faculty: "",
      university: "",
      activityName: "",
      organizer: "",
      issueDate: "",
      semester: "",
      academicYear: "",
      score: "",
      volunteerDays: 0,
      achievement: ""
    };

    const safeVerification = currentAiResult.verification || {
      hasStudentIdentity: false,
      hasOrganizer: false,
      hasDate: false,
      hasAchievement: false,
      matchesCurrentStudent: "unknown"
    };

    evidence.storageStatus =
      evidence.filePath && fs.existsSync(evidence.filePath)
        ? "local_temp"
        : evidence.storageStatus || "none";

    evidence.aiResult = {
      isValid:
        currentAiResult.isValid === true
          ? true
          : currentAiResult.isValid === false
          ? false
          : null,

      confidence: Number(currentAiResult.confidence || 0),

      matchedType: currentAiResult.matchedType || "",
      subCriteria: currentAiResult.subCriteria || "",
      academicEvidenceType: currentAiResult.academicEvidenceType || "",
      academicActivityCount: Number(
        currentAiResult.academicActivityCount || 0
      ),

      volunteerDays: Number(currentAiResult.volunteerDays || 0),
      volunteerActivityName: currentAiResult.volunteerActivityName || "",
      hasVolunteerAward: currentAiResult.hasVolunteerAward === true,

      kyNangEvidenceType: currentAiResult.kyNangEvidenceType || "",
      foreignLanguageEvidenceType:
        currentAiResult.foreignLanguageEvidenceType || "",
      hoiNhapEvidenceType: currentAiResult.hoiNhapEvidenceType || "",
      awardRank: currentAiResult.awardRank || "",
      organizerLevel: currentAiResult.organizerLevel || "",

      sv5tHistoryType: currentAiResult.sv5tHistoryType || "",
      sv5tHistoryLevel: currentAiResult.sv5tHistoryLevel || "",
      sv5tHistoryYears: Array.isArray(currentAiResult.sv5tHistoryYears)
        ? currentAiResult.sv5tHistoryYears
        : [],
      consecutiveYears: Number(currentAiResult.consecutiveYears || 0),
      issuer: currentAiResult.issuer || "",
      awardTitle: currentAiResult.awardTitle || "",

      extractedText: currentAiResult.extractedText || "",
      matchedEvidence: Array.isArray(currentAiResult.matchedEvidence)
        ? currentAiResult.matchedEvidence
        : [],

      promptVersion: currentAiResult.promptVersion || "",
      evidenceType: currentAiResult.evidenceType || "",
      matchedCategory:
        currentAiResult.matchedCategory || evidence.category || "",
      matchedSubCriteria: Array.isArray(currentAiResult.matchedSubCriteria)
        ? currentAiResult.matchedSubCriteria
        : [],

      decision: currentAiResult.decision || "",

      warningFlags: [
        ...currentWarningFlags,
        "r2_archive_failed"
      ],

      extractedInfo: safeExtractedInfo,
      verification: safeVerification,

      missingInfo: [
        ...currentMissingInfo,
        `AI đã xử lý xong nhưng chưa lưu được file lên Cloudflare R2: ${error.message}`
      ],

      reason: currentAiResult.reason
        ? `${currentAiResult.reason} Lưu ý hệ thống: AI đã xử lý xong nhưng chưa lưu được file lên Cloudflare R2, admin cần kiểm tra storage.`
        : "AI đã xử lý xong nhưng chưa lưu được file lên Cloudflare R2, admin cần kiểm tra storage."
    };

    await evidence.save();
    return evidence;
  }
}

/**
 * Xóa file minh chứng khỏi nơi lưu trữ hiện tại (local temp hoặc R2), dùng khi
 * admin từ chối minh chứng và không cần lưu lại file nữa.
 */
async function deleteEvidenceFile(evidence) {
  if (!evidence) return null;

  if (evidence.storageStatus === "local_temp" && evidence.filePath) {
    if (fs.existsSync(evidence.filePath)) {
      fs.unlinkSync(evidence.filePath);
    }

    evidence.filePath = "";
    evidence.storageStatus = "deleted";
    await evidence.save();

    return evidence;
  }

  if (evidence.storageStatus === "r2_archived" && evidence.fileKey) {
    await deleteFromR2(evidence.fileKey);

    evidence.fileKey = "";
    evidence.fileUrl = "";
    evidence.storageStatus = "deleted";
    await evidence.save();

    return evidence;
  }

  return evidence;
}

module.exports = {
  archiveEvidenceToR2,
  safeArchiveEvidenceToR2,
  deleteEvidenceFile,
  getEvidenceFileUrl
};
