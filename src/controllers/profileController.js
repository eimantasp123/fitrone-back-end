const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const verificationHelper = require("../helper/verificationHelper");
const sharp = require("sharp");
const {
  validateFile,
  uploadToS3,
  deleteFromS3,
} = require("../utils/s3helpers");

/**
 * Constants for file upload
 */
const maxFileSize = 5 * 1024 * 1024; // 5MB
const allowedFileTypes = ["image/jpeg", "image/png", "image/jpg"]; // Allowed image types

/**
 * Multer memory storage for storing files in memory
 */
const storage = multer.memoryStorage();
exports.upload = multer({ storage });
const DEFAULT_PROFILE_IMAGE =
  "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

/**
 * Upload profile image to AWS S3 bucket and update user profile image
 */
exports.uploadImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError(req.t("noFileUploaded"), 400));
  }
  // Validate file type and size
  if (!validateFile(req.file, allowedFileTypes, maxFileSize)) {
    return next(new AppError(req.t("invalidFileType"), 400));
  }

  // Find user by ID
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError(req.t("userNotFound"), 404));
  }

  // Delete existing profile image from AWS S3 bucket
  if (user.profileImage && !user.profileImage.includes(DEFAULT_PROFILE_IMAGE)) {
    const existingImageKey = user.profileImage.replace(
      `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`,
      "",
    );

    // Delete existing profile image from AWS S3 bucket
    try {
      await deleteFromS3(existingImageKey);
    } catch (err) {
      return next(
        new AppError(req.t("profile:error.deletingProfileImage"), 500),
      );
    }
  }

  // Compress and resize image
  const compressedImageBuffer = await sharp(req.file.buffer)
    .resize({ width: 800 })
    .jpeg({ quality: 80 })
    .toBuffer();

  // Upload new profile image
  const fileName = `users/${user._id}/profile/${uuidv4()}-${req.file.originalname}`;

  // Upload compressed image to AWS S3 bucket
  try {
    const profileImageUrl = await uploadToS3(
      fileName,
      compressedImageBuffer,
      req.file.mimetype,
    );

    // Update user profile image
    user.profileImage = profileImageUrl;
    await user.save({ validateBeforeSave: false });
  } catch (error) {
    throw new AppError(req.t("profile:error.uploadingProfileImage"), 500);
  }

  // Send response
  res.json({
    message: req.t("profile:imageUpdatedSuccessfully"),
    profileImage: user.profileImage,
  });
});

/**
 * Delete user profile image from AWS S3 bucket and set profile image to default
 */
exports.deleteImage = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError(req.t("userNotFound"), 404));
  }

  // Delete profile image from AWS S3 bucket (if not default)
  if (user.profileImage && !user.profileImage.includes(DEFAULT_PROFILE_IMAGE)) {
    const existingImageKey = user.profileImage.replace(
      `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`,
      "",
    );

    // Delete existing profile image from AWS S3 bucket
    try {
      await deleteFromS3(existingImageKey);
    } catch (err) {
      console.error(req.t("profile:error.deletingProfileImage"), err.message);
    }
  }

  // Set profile image to default
  user.profileImage = DEFAULT_PROFILE_IMAGE;
  await user.save({ validateBeforeSave: false });

  // Send response
  res.json({
    message: req.t("profile:imageDeleteSuccessfully"),
    profileImage: user.profileImage,
  });
});

/**
 * Update user profile details in the database
 */
exports.updateProfileDetails = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError(req.t("userNotFound"), 404));
  }

  // Check if user has 2FA enabled and trying to change phone number
  if (
    req.body.phone !== undefined &&
    req.body.phone !== user.phone &&
    user.is2FAEnabled
  ) {
    return next(new AppError(req.t("profile:error.changePhoneWith2FA"), 400));
  }

  // Allowed fields to be updated
  const allowedUpdates = ["firstName", "lastName", "email", "phone"];
  const updates = {};

  // Check if the fields to be updated are allowed
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined && req.body[field] !== user[field]) {
      updates[field] = req.body[field];
      user[field] = req.body[field];
    }
  });

  await user.save({ validateBeforeSave: false });

  // Send response
  res.status(200).json({
    message: req.t("profile:successUpdateDetails"),
    updatedFields: updates,
  });
});

/**
 * Update user password in the database
 */
exports.updateProfilePassword = catchAsync(async (req, res, next) => {
  const { oldPassword, newPassword, confirmNewPassword } = req.body;
  const user = await User.findById(req.user.id).select("+password");

  // Check if user exists
  if (!user) {
    return next(new AppError(req.t("userNotFound"), 404));
  }

  // Check if user has password (not social login)
  if (!user.password) {
    return next(
      new AppError(req.t("profile:error.changePassworWithSocialLogin"), 400),
    );
  }

  // Check if new password and confirm new password match
  if (!(await user.correctPassword(oldPassword, user.password))) {
    return next(new AppError(req.t("profile:error.oldPasswordNotMatch"), 401));
  }

  user.password = newPassword;
  user.passwordConfirm = confirmNewPassword;
  await user.save();

  // Send response
  res
    .status(200)
    .json({ message: req.t("profile:passwordChangedSuccessfully") });
});

/**
 * Request 2FA code to be sent to user's phone
 */
exports.request2FACode = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  // Check if user exists
  if (!user) {
    return next(new AppError(req.t("userNotFound"), 404));
  }

  // Send 2FA code to user's phone
  await verificationHelper.send2FACode(user, req, next);

  // Send response
  res
    .status(200)
    .json({ message: req.t("profile:verifyCodeSendSuccessfully") });
});

/**
 * Verify 2FA code sent to user's phone
 */
exports.verify2FACode = catchAsync(async (req, res, next) => {
  const { code } = req.body;
  const user = await User.findById(req.user.id);

  // Check if user exists
  if (!user) {
    return next(new AppError(req.t("userNotFound"), 404));
  }

  // Check if user has requested 2FA code
  if (user.twoFactorCode !== code || user.twoFactorExpires < Date.now()) {
    return next(new AppError(req.t("profile:error.invalidOrExpiredCode"), 400));
  }

  user.is2FAEnabled = !user.is2FAEnabled;
  user.twoFactorCode = undefined;
  user.twoFactorExpires = undefined;

  await user.save({ validateBeforeSave: false });

  // Send response with 2FA status
  const statusTranslation = user.is2FAEnabled
    ? req.t("profile:twoFactorAuth.enabled")
    : req.t("profile:twoFactorAuth.disabled");

  res.status(200).json({
    message: req.t("profile:twoFactorAuth.status", {
      status: statusTranslation,
    }),
    is2FAEnabled: user.is2FAEnabled,
  });
});

/**
 * Delete user account from the database
 */
exports.deleteAccount = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  // Check if user exists
  if (!user) {
    return next(new AppError(req.t("userNotFound"), 404));
  }

  // Delete user account
  await User.findByIdAndDelete(req.user.id);

  // Clear cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  // Send response
  res.json({ message: req.t("profile:accountDeletedSuccessfully") });
});
