const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { sendVerificationCode, verifyCode } = require("../utils/twilioClient");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const verificationHelper = require("../helper/verificationHelper");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const storage = multer.memoryStorage();
exports.upload = multer({ storage });

// Upload profile image to AWS S3 bucket and update user profile image
exports.uploadImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("No file uploaded", 400));
  }
  const fileContent = req.file.buffer;
  const fileName = `${uuidv4()}-${req.file.originalname}`;
  // Find user by id
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  // Delete existing profile image from AWS S3 bucket
  if (user.profileImage && !user.profileImage.includes("gravatar.com")) {
    const existingImageName = user.profileImage.split("/").pop();
    const deleteParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: existingImageName,
    };
    const deleteCommand = new DeleteObjectCommand(deleteParams);
    await s3.send(deleteCommand);
  }

  const uploadParams = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: fileName,
    Body: fileContent,
    ContentType: req.file.mimetype,
  };
  // Upload new profile image to AWS S3 bucket
  const uploadCommand = new PutObjectCommand(uploadParams);
  await s3.send(uploadCommand);
  const profileImageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  // Update user profile image
  user.profileImage = profileImageUrl;
  await user.save({ validateBeforeSave: false });
  res.json({
    message: "Profile image updated successfully",
    profileImage: user.profileImage,
  });
});

// Delete profile image from AWS S3 bucket and set profile image to default
exports.deleteImage = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  // Delete profile image from AWS S3 bucket
  const imageUrl = user.profileImage;
  const imageName = imageUrl.split("/").pop();
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: imageName,
  };
  const command = new DeleteObjectCommand(params);
  await s3.send(command);
  // Set profile image to default
  user.profileImage =
    "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";
  await user.save({ validateBeforeSave: false });
  res.json({
    message: "Profile image deleted successfully",
    profileImage: user.profileImage,
  });
});

// Update user profile details (firstName, lastName, email, phone) in the database and return updated fields
exports.updateProfileDetails = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  const allowedUpdates = ["firstName", "lastName", "email", "phone"];
  const updates = {};
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined && req.body[field] !== user[field]) {
      updates[field] = req.body[field];
      user[field] = req.body[field];
    }
  });
  if (Object.keys(updates).length === 0) {
    res.status(200).json({ message: "No changes made." });
  } else {
    await user.save({ validateBeforeSave: false });
    res.status(200).json({
      message: "Profile updated successfully",
      updatedFields: updates,
    });
  }
});

// Update user password in the database
exports.updateProfilePassword = catchAsync(async (req, res, next) => {
  const { oldPassword, newPassword, confirmNewPassword } = req.body;
  const user = await User.findById(req.user.id).select("+password");
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  if (!user.password) {
    return next(
      new AppError(
        "You can not change password, because you use different login method.",
        400,
      ),
    );
  }
  if (!(await user.correctPassword(oldPassword, user.password))) {
    return next(new AppError("Old password is incorrect", 401));
  }
  user.password = newPassword;
  user.passwordConfirm = confirmNewPassword;
  await user.save();
  res.status(200).json({ message: "Password updated successfully" });
});

// Request 2FA code to be sent to user's phone
exports.request2FACode = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  await verificationHelper.send2FACode(user);
  res.status(200).json({ message: "Verification code sent to your phone." });
});

// Verify 2FA code sent to user's phone
exports.verify2FACode = catchAsync(async (req, res, next) => {
  const { code, enable } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  if (user.twoFactorCode !== code || user.twoFactorExpires < Date.now()) {
    return next(new AppError("Invalid or expired code", 400));
  }
  user.is2FAEnabled = enable;
  user.twoFactorCode = undefined;
  user.twoFactorExpires = undefined;
  await user.save({ validateBeforeSave: false });
  res.status(200).json({
    message: `2FA ${enable ? "enabled" : "disabled"} successfully.`,
  });
});

// Delete user account from the database
exports.deleteAccount = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  await User.findByIdAndDelete(req.user.id);
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ message: "Account deleted successfully" });
});
