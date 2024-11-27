const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const AppError = require("../utils/appError");

// Initialize AWS S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Validate file type and size
exports.validateFile = (file, allowedTypes, maxSize) => {
  if (!allowedTypes.includes(file.mimetype)) {
    return false; // Invalid file type
  }
  if (file.size > maxSize) {
    return false; // File exceeds size limit
  }
  return true; // File is valid
};

// Upload file to S3
exports.uploadToS3 = async (key, buffer, mimeType) => {
  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  };
  await s3.send(new PutObjectCommand(uploadParams));
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

// Delete an object from the S3 bucket
exports.deleteFromS3 = async (key) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  };
  await s3.send(new DeleteObjectCommand(params));
};
