const fs = require("fs");
const path = require("path");

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} = require("@aws-sdk/client-s3");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const PRESIGNED_URL_EXPIRES_IN_SECONDS = 900; // 15 phút

function assertR2Config() {
  const required = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME"
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Thiếu cấu hình Cloudflare R2: ${missing.join(", ")}`);
  }
}

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

function buildEvidenceKey(studentId, originalName) {
  const ext = path.extname(originalName || "");
  const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  return `evidence/${studentId}/${safeName}`;
}

async function uploadBufferToR2({ buffer, key, contentType }) {
  assertR2Config();
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType
  });

  await r2Client.send(command);

  // Bucket R2 không còn ở chế độ Public — không trả về URL công khai nữa.
  // Người xem file phải qua getPresignedFileUrl() để được cấp URL có thời hạn.
  return {
    key,
    url: ""
  };
}

/**
 * Sinh URL có thời hạn (mặc định 15 phút) để xem/tải file trên R2.
 * Backend phải tự kiểm tra quyền sở hữu/quyền admin phụ trách trước khi gọi hàm này.
 */
async function getPresignedFileUrl(key, expiresIn = PRESIGNED_URL_EXPIRES_IN_SECONDS) {
  if (!key) return "";
  assertR2Config();

  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

async function uploadLocalFileToR2({ localPath, key, contentType }) {
  if (!localPath || !fs.existsSync(localPath)) {
    throw new Error("Không tìm thấy file local để upload lên Cloudflare R2");
  }

  const buffer = fs.readFileSync(localPath);

  return uploadBufferToR2({
    buffer,
    key,
    contentType
  });
}

async function deleteFromR2(key) {
  if (!key) return;
  assertR2Config();

  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key
  });

  await r2Client.send(command);
}

/**
 * Trả về URL xem file cho một Evidence: presigned URL có thời hạn nếu file
 * đã được archive lên R2, ngược lại trả về fileUrl cũ (nếu có) hoặc rỗng.
 * Route gọi hàm này phải tự kiểm tra quyền xem trước (chủ sở hữu hoặc admin phụ trách).
 */
async function getEvidenceFileUrl(evidence) {
  if (!evidence) return "";

  if (evidence.storageStatus === "r2_archived" && evidence.fileKey) {
    try {
      return await getPresignedFileUrl(evidence.fileKey);
    } catch (error) {
      console.error("getEvidenceFileUrl error:", error.message);
      return "";
    }
  }

  return evidence.fileUrl || "";
}

module.exports = {
  buildEvidenceKey,
  uploadBufferToR2,
  uploadLocalFileToR2,
  deleteFromR2,
  assertR2Config,
  getPresignedFileUrl,
  getEvidenceFileUrl
};