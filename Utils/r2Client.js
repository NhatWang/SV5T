const fs = require("fs");
const path = require("path");

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");

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
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType
  });

  await r2Client.send(command);

  const publicBaseUrl = process.env.R2_PUBLIC_URL;

  return {
    key,
    url: publicBaseUrl ? `${publicBaseUrl}/${key}` : ""
  };
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

  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key
  });

  await r2Client.send(command);
}

module.exports = {
  buildEvidenceKey,
  uploadBufferToR2,
  uploadLocalFileToR2,
  deleteFromR2
};