const jwt = require("jsonwebtoken");
const axios = require("axios");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const User = require("../models/User");
const verificationHelper = require("./../helper/verificationHelper");

// Register new user and send verification email to user
exports.registerEmail = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  // Check if email is provided
  let user = await User.findOne({ email }).select(
    "+isVerified +registrationCompleted",
  );
  // Check if user already exists
  if (user && user.isVerified && user.registrationCompleted) {
    return next(new AppError("This email is already registered", 400));
  }
  // Check if user exists but not verified and registration not completed
  if (user && !user.isVerified && !user.registrationCompleted) {
    return verificationHelper.handleVerificationEmailSending(user, res, next);
  }
  // Check if user exists but not verified and registration not completed
  if (user && user.isVerified && !user.registrationCompleted) {
    user.isVerified = false;
    await user.save({ validateBeforeSave: false });
    return verificationHelper.handleVerificationEmailSending(user, res, next);
  }
  // Create new user if user does not exist
  user = new User({ email });
  await user.save({ validateBeforeSave: false });
  return verificationHelper.handleVerificationEmailSending(user, res, next);
});

// Verify user's email and set user as verified
exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { email, code } = req.body;
  const user = await User.findOne({
    email,
    emailVerificationCode: code,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError("Invalid or expired token", 400));
  }

  user.isVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Email verified successfully",
  });
});

// Resend verification email to user
exports.resendVerificationEmailCode = catchAsync(async (req, res, next) => {
  const user = await User.findOne({
    email: req.body.email,
    isVerified: false,
  });
  if (!user) {
    return next(new AppError("User not found or already verified", 404));
  }
  return verificationHelper.handleVerificationEmailSending(user, res, next);
});

// Complete user registration with email, password, first name and last name
exports.completeRegistration = catchAsync(async (req, res, next) => {
  const { email, password, passwordConfirm, firstName, lastName } = req.body;
  const user = await User.findOne({
    email,
    isVerified: true,
    registrationCompleted: false,
  });

  if (!user) {
    return next(new AppError("User not found or already register", 404));
  }

  user.password = password;
  user.passwordConfirm = passwordConfirm;
  user.firstName = firstName;
  user.lastName = lastName;
  user.registrationCompleted = true;
  await user.save();

  await verificationHelper.sendTokensAndCookies(
    user,
    res,
    "Register in successfully",
  );
});

// Login user with email and password and send access token and refresh token to cookies
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new AppError("Please provide email and password", 400));
  }
  const user = await User.findOne({ email }).select("+password +isVerified");
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  if (!user.isVerified) {
    return next(new AppError("Email not verified.", 400));
  }
  if (user.googleId || user.facebookId) {
    return next(
      new AppError(
        "This email is registered with a different login method.",
        404,
      ),
    );
  }
  // Check if password is correct
  const correct = await user.correctPassword(password, user.password);
  if (!correct) {
    return next(new AppError("Incorrect email or password", 401));
  }
  if (user.is2FAEnabled) {
    // Send verification code
    await verificationHelper.send2FACode(user);
    return res.status(200).json({
      status: "success",
      message: "Verification code sent successfully",
      is2FA: user.is2FAEnabled,
      userId: user._id,
    });
  }
  verificationHelper.sendTokensAndCookies(user, res, "Logged in successfully");
});

// Resend verification code to user
exports.resendCode = catchAsync(async (req, res) => {
  const { userId } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(400).json({ message: "Invalid user" });
  await verificationHelper.send2FACode(user);
  return res.status(200).json({
    status: "success",
    message: "Verification code resend successfully",
  });
});

// Verify login with user ID and code and send access token and refresh token to cookies
exports.verifyLogin = catchAsync(async (req, res, next) => {
  const { userId, code } = req.body;
  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  if (user.twoFactorCode !== code || user.twoFactorExpires < Date.now()) {
    return next(new AppError("Invalid or expired code", 400));
  }
  user.twoFactorCode = undefined;
  user.twoFactorExpires = undefined;
  await user.save({ validateBeforeSave: false });
  verificationHelper.sendTokensAndCookies(user, res, "Logged in successfully");
});

// Logout user and remove access token and refresh token from cookies
exports.logout = catchAsync(async (req, res, next) => {
  const { accessToken } = req.cookies;
  if (!accessToken) {
    return next(new AppError("You are not logged in", 401));
  }
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res
    .status(200)
    .json({ status: "success", message: "Logged out successfully" });
});

// Forgot password functionality to send reset password email to user
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email }).select(
    "+isVerified +registrationCompleted",
  );
  if (!user) return next(new AppError("User not found", 404));
  if (user.googleId || user.facebookId) {
    return next(
      new AppError(
        "This email is registered with a different login method.",
        404,
      ),
    );
  }
  if (!user.isVerified) {
    return next(new AppError("Email not verified", 400));
  }
  if (!user.registrationCompleted) {
    return next(
      new AppError(
        "User registration not completed. Try register again and complete registration.",
        400,
      ),
    );
  }
  // Create reset password token and send reset password email
  await verificationHelper.sendPasswordResetEmail(user, req, next);
  res.status(200).json({
    status: "success",
    message: "Reset password email sent successfully",
  });
});

// Reset password functionality to reset user's password
exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { password, passwordConfirm } = req.body.data;

  const user = await User.findByResetToken(token);
  if (!user) return next(new AppError("Invalid or expired token", 400));

  await user.resetPassword(password, passwordConfirm);
  verificationHelper.sendTokensAndCookies(
    user,
    res,
    "Password reset successfully",
  );
});

// Login user with Facebook and send access token and refresh token to cookies
exports.facebookAuth = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("No token provided or invalid token format", 400));
  }
  const token = authHeader.split(" ")[1];
  const response = await axios.get(
    `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture&access_token=${token}`,
  );
  const { id, email, picture, first_name, last_name } = response.data;
  let user = await User.findOne({ email }).select(
    "+isVerified +registrationCompleted",
  );
  if (!user) {
    user = new User({
      facebookId: id,
      email,
      isVerified: true,
      registrationCompleted: true,
      firstName: first_name,
      lastName: last_name,
      profileImage: picture.data.url,
    });
    await user.save({ validateBeforeSave: false });
  } else if (user.facebookId !== id) {
    return next(new AppError("This email is already registered", 400));
  }

  if (user.is2FAEnabled) {
    // Send verification code
    await verificationHelper.send2FACode(user);
    // Send response to client
    return res.status(200).json({
      status: "success",
      message: "Verification code sent successfully",
      is2FA: user.is2FAEnabled,
      userId: user._id,
    });
  }
  verificationHelper.sendTokensAndCookies(user, res, "Logged in successfully");
});

// Login user with Google and send access token and refresh token to cookies
exports.googleAuth = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("No token provided or invalid token format", 400));
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return next(new AppError("Token is required", 400));
  }
  const response = await axios.get(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const { sub, email, picture, given_name, family_name } = response.data;
  const highResPicture = picture ? picture.replace("s96-c", "s400-c") : "";
  let user = await User.findOne({ email: email });
  if (!user) {
    user = new User({
      googleId: sub,
      email,
      firstName: given_name,
      lastName: family_name,
      isVerified: true,
      profileImage: highResPicture,
    });
    await user.save({ validateBeforeSave: false });
  } else if (user.googleId !== sub) {
    return next(new AppError("This email is already registered", 400));
  }
  if (user.is2FAEnabled) {
    await verificationHelper.send2FACode(user);
    return res.status(200).json({
      status: "success",
      message: "Verification code sent successfully",
      is2FA: user.is2FAEnabled,
      userId: user._id,
    });
  } else {
    verificationHelper.sendTokensAndCookies(
      user,
      res,
      "Logged in successfully",
    );
  }
});

// Refresh access token with refresh token
exports.refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return next(
      new AppError("Refresh token not found, please login again", 401),
    );
  }
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  verificationHelper.sendTokensAndCookies(
    user,
    res,
    "Token refreshed successfully",
  );
});

// Get current user details
exports.getCurrentUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  res.status(200).json({
    status: "success",
    user,
  });
});

// Restrict routes to specific roles
exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }
    next();
  };
