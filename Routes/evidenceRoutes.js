const express = require("express");

const {
  requireStudentAuth,
  requireAdminAuth,
  requireSuperAdmin
} = require("../Middlewares/authMiddleware");

const evidenceController = require("../controllers/evidenceController");

const router = express.Router();

router.get(
  "/test-azure",
  requireAdminAuth,
  requireSuperAdmin,
  evidenceController.testAzureConnection
);

router.post(
  "/upload",
  requireStudentAuth,
  evidenceController.uploadEvidenceMiddleware,
  evidenceController.uploadEvidence
);

router.get(
  "/student/:studentId",
  requireStudentAuth,
  evidenceController.getStudentEvidences
);

router.get(
  "/:evidenceId/status",
  requireStudentAuth,
  evidenceController.getEvidenceStatus
);

module.exports = router;
