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
} = require("../utils/s3Helpers");
const maxFileSize = 5 * 1024 * 1024; // 5MB
const allowedFileTypes = ["image/jpeg", "image/png", "image/jpg"]; // Allowed image types

const storage = multer.memoryStorage();
exports.upload = multer({ storage });
const DEFAULT_PROFILE_IMAGE =
  "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

// Upload profile image to AWS S3 bucket and update user profile image
exports.uploadImage = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError(req.t("noFileUploaded"), 400));
  }
  // Validate file type and size
  if (!validateFile(req.file, allowedFileTypes, maxFileSize)) {
    return next(new AppError("Invalid file type or size exceeds limit", 400));
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

    try {
      await deleteFromS3(existingImageKey);
    } catch (err) {
      return next(
        new AppError(req.t("profile:error.deletingProfileImage"), 500),
      );
    }
  }

  const compressedImageBuffer = await sharp(req.file.buffer)
    .resize({ width: 800 })
    .jpeg({ quality: 80 })
    .toBuffer();

  // Upload new profile image
  const fileName = `users/${user._id}/profile/${uuidv4()}-${req.file.originalname}`;

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

  res.json({
    message: req.t("profile:imageUpdatedSuccessfully"),
    profileImage: user.profileImage,
  });
});

// Delete profile image from AWS S3 bucket and set profile image to default
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

    try {
      await deleteFromS3(existingImageKey);
    } catch (err) {
      console.error(req.t("profile:error.deletingProfileImage"), err.message);
    }
  }

  // Set profile image to default
  user.profileImage = DEFAULT_PROFILE_IMAGE;
  await user.save({ validateBeforeSave: false });

  res.json({
    message: req.t("profile:imageDeleteSuccessfully"),
    profileImage: user.profileImage,
  });
});

// Update user profile details (firstName, lastName, email, phone) in the database and return updated fields
exports.updateProfileDetails = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError(req.t("userNotFound"), 404));
  }
  const allowedUpdates = ["firstName", "lastName", "email", "phone"];
  const updates = {};
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined && req.body[field] !== user[field]) {
      updates[field] = req.body[field];
      user[field] = req.body[field];
    }
  });

  await user.save({ validateBeforeSave: false });
  res.status(200).json({
    message: req.t("profile:successUpdateDetails"),
    updatedFields: updates,
  });
});

// Update user password in the database
exports.updateProfilePassword = catchAsync(async (req, res, next) => {
  const { oldPassword, newPassword, confirmNewPassword } = req.body;
  const user = await User.findById(req.user.id).select("+password");
  if (!user) {
    return next(new AppError(req.t("userNotFound"), 404));
  }
  if (!user.password) {
    return next(
      new AppError(req.t("profile:error.changePassworWithSocialLogin"), 400),
    );
  }
  if (!(await user.correctPassword(oldPassword, user.password))) {
    return next(new AppError(req.t("profile:error.oldPasswordNotMatch"), 401));
  }
  user.password = newPassword;
  user.passwordConfirm = confirmNewPassword;
  await user.save();
  res
    .status(200)
    .json({ message: req.t("profile:passwordChangedSuccessfully") });
});

// Request 2FA code to be sent to user's phone
exports.request2FACode = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError(req.t("userNotFound"), 404));
  }
  await verificationHelper.send2FACode(user);
  res
    .status(200)
    .json({ message: req.t("profile:verifyCodeSendSuccessfully") });
});

// Verify 2FA code sent to user's phone
exports.verify2FACode = catchAsync(async (req, res, next) => {
  const { code } = req.body;
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new AppError(req.t("userNotFound"), 404));
  }
  if (user.twoFactorCode !== code || user.twoFactorExpires < Date.now()) {
    return next(new AppError(req.t("profile:error.invalidOrExpiredCode"), 400));
  }
  user.is2FAEnabled = !user.is2FAEnabled;
  user.twoFactorCode = undefined;
  user.twoFactorExpires = undefined;
  await user.save({ validateBeforeSave: false });

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

// Delete user account from the database
exports.deleteAccount = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError(req.t("userNotFound"), 404));
  }
  await User.findByIdAndDelete(req.user.id);
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.json({ message: req.t("profile:accountDeletedSuccessfully") });
});
