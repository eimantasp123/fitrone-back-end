const jwt = require("jsonwebtoken");
const axios = require("axios");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const User = require("../models/User");
const verificationHelper = require("./../helper/verificationHelper");
const { sendMessageToClients } = require("../utils/websocket");

/**
 * Register a new user by email and send a verification email.
 */
exports.registerEmail = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  // Check if email is provided
  let user = await User.findOne({ email }).select(
    "+isVerified +registrationCompleted",
  );

  // Check if user already exists and is verified and registration completed
  if (user && user.isVerified && user.registrationCompleted) {
    return next(new AppError(req.t("auth:emailAlreadyRegistered"), 400));
  }

  // Check if user already exists and is not verified and registration not completed
  if (user && !user.isVerified && !user.registrationCompleted) {
    return await verificationHelper.handleVerificationEmailSending(
      user,
      res,
      req,
      next,
    );
  }

  // Check if user already exists and is verified and registration not completed
  if (user && user.isVerified && !user.registrationCompleted) {
    user.isVerified = false;
    await user.save({ validateBeforeSave: false });
    return await verificationHelper.handleVerificationEmailSending(
      user,
      res,
      req,
      next,
    );
  }

  // Create a new user if user does not exist
  user = new User({ email });
  await user.save({ validateBeforeSave: false });

  // Send verification email
  return await verificationHelper.handleVerificationEmailSending(
    user,
    res,
    req,
    next,
  );
});

/**
 * Verify user email using a verification code.
 */
exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { email, code } = req.body;

  //  Find user with email and verification code
  const user = await User.findOne({
    email,
    emailVerificationCode: code,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError(req.t("auth:invalidOrExpiredToken"), 400));
  }

  // Set user as verified
  user.isVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;

  await user.save({ validateBeforeSave: false });

  // Send response
  return res.status(200).json({
    status: "success",
    message: req.t("auth:emailVerifiedSuccess"),
  });
});

/**
 * Resend verification email to user.
 */
exports.resendVerificationEmailCode = catchAsync(async (req, res, next) => {
  // Find user with email and is not verified
  const user = await User.findOne({
    email: req.body.email,
    isVerified: false,
  });

  // Check if user exists
  if (!user) {
    return next(new AppError(req.t("auth:userNotFoundOrAlreadyVerified"), 404));
  }

  // Send verification email
  return await verificationHelper.handleVerificationEmailSending(
    user,
    res,
    req,
    next,
  );
});

/**
 * Complete user registration with email, password, first name and last name.
 */
exports.completeRegistration = catchAsync(async (req, res, next) => {
  const { email, password, passwordConfirm, firstName, lastName } = req.body;

  // Find user with email and is verified and registration not completed
  const user = await User.findOne({
    email,
    isVerified: true,
    registrationCompleted: false,
  });

  if (!user) {
    return next(
      new AppError(req.t("auth:userNotFoundOrAlreadyRegistered"), 404),
    );
  }

  // Set user details
  user.password = password;
  user.passwordConfirm = passwordConfirm;
  user.firstName = firstName;
  user.lastName = lastName;
  user.registrationCompleted = true;
  await user.save();

  // Send response with access token and refresh token
  return verificationHelper.sendTokensAndCookies(
    user,
    res,
    req.t("auth:registerSuccess"),
  );
});

/**
 * Login user with email and password and send access token and refresh token to cookies.
 */
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    return next(new AppError(req.t("auth:missingEmailOrPassword"), 400));
  }

  const user = await User.findOne({ email }).select("+password +isVerified");

  // Check if user exists
  if (!user) {
    return next(new AppError(req.t("auth:userNotFound"), 404));
  }

  // Check if user is verified
  if (!user.isVerified) {
    return next(new AppError(req.t("auth:emailNotVerified"), 400));
  }

  // Check if user has completed registration
  if (user.googleId || user.facebookId) {
    return next(new AppError(req.t("auth:differentLoginMethod"), 404));
  }

  // Check if password is correct
  const correct = await user.correctPassword(password, user.password);
  if (!correct) {
    return next(new AppError(req.t("auth:incorrectEmailOrPassword"), 401));
  }

  // Check if user has 2FA enabled
  if (user.is2FAEnabled) {
    // Send verification code
    await verificationHelper.send2FACode(user, req, next);

    // Send response
    return res.status(200).json({
      status: "success",
      message: req.t("auth:verificationCodeSent"),
      is2FA: user.is2FAEnabled,
      userId: user._id,
    });
  }

  // Send response with access token and refresh token
  return verificationHelper.sendTokensAndCookies(
    user,
    res,
    req.t("auth:loginSuccess"),
  );
});

/**
 * Resend verification code to user.
 */
exports.resendCode = catchAsync(async (req, res, next) => {
  const { userId } = req.body;

  // Find user with user ID
  const user = await User.findById(userId);
  if (!user)
    return res.status(400).json({ message: req.t("auth:invalidUser") });

  // Check if user has 2FA enabled
  await verificationHelper.send2FACode(user, req, next);

  // Send response
  return res.status(200).json({
    status: "success",
    message: req.t("auth:verificationCodeResent"),
  });
});

/**
 * Verify login with user ID and code and send access token and refresh token to cookies.
 */
exports.verifyLogin = catchAsync(async (req, res, next) => {
  const { userId, code } = req.body;

  // Find user with user ID
  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError(req.t("auth:userNotFound"), 404));
  }

  // Check if user has 2FA enabled, code is correct and not expired
  if (user.twoFactorCode !== code || user.twoFactorExpires < Date.now()) {
    return next(new AppError(req.t("auth:invalidOrExpiredToken"), 400));
  }

  user.twoFactorCode = undefined;
  user.twoFactorExpires = undefined;
  await user.save({ validateBeforeSave: false });

  // Send response with access token and refresh token
  return verificationHelper.sendTokensAndCookies(
    user,
    res,
    req.t("auth:loginSuccess"),
  );
});

/**
 * Logout user and clear cookies.
 */
exports.logout = catchAsync(async (req, res, next) => {
  const { accessToken } = req.cookies;

  // Check if user is logged in
  if (!accessToken) {
    return next(new AppError(req.t("auth:notLoggedIn"), 401));
  }

  // Clear cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  //  Send response
  return res
    .status(200)
    .json({ status: "success", message: req.t("auth:logoutSuccess") });
});

/**
 * Forgot password functionality to send reset password email to user.
 */
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  // Find user with email
  const user = await User.findOne({ email }).select(
    "+isVerified +registrationCompleted",
  );
  if (!user) return next(new AppError(req.t("auth:userNotFound"), 404));

  // Check if user login method is different
  if (user.googleId || user.facebookId) {
    return next(new AppError(req.t("auth:differentLoginMethod"), 404));
  }

  // Check if user is verified
  if (!user.isVerified) {
    return next(new AppError(req.t("auth:emailNotVerified"), 400));
  }

  // Check if user has completed registration
  if (!user.registrationCompleted) {
    return next(new AppError(req.t("auth:userNotCompletedRegistration"), 400));
  }

  // Create reset password token and send reset password email
  return await verificationHelper.handleSendPasswordResetEmail(
    user,
    res,
    req,
    next,
  );
});

/**
 * Reset user password with reset token.
 */
exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { password, passwordConfirm } = req.body.data;

  // Find user with reset token
  const user = await User.findByResetToken(token);
  if (!user)
    return next(new AppError(req.t("auth:invalidOrExpiredToken"), 400));

  // Reset user password
  await user.resetPassword(password, passwordConfirm);

  // Send response with access token and refresh token
  return verificationHelper.sendTokensAndCookies(
    user,
    res,
    req.t("auth:passwordResetSuccess"),
  );
});

/**
 * Login user with Facebook and send access token and refresh token to cookies.
 */
exports.facebookAuth = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check if token is provided
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError(req.t("auth:noProvidedToken"), 400));
  }

  const token = authHeader.split(" ")[1];
  const response = await axios.get(
    `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture&access_token=${token}`,
  );

  // Get user details from Facebook
  const { id, email, picture, first_name, last_name } = response.data;

  // Check if user exists
  let user = await User.findOne({ email }).select(
    "+isVerified +registrationCompleted",
  );

  // Check if user exists and registration not completed
  if (user) {
    if (!user.registrationCompleted) {
      user.facebookId = id;
      user.firstName = first_name;
      user.lastName = last_name;
      user.profileImage = picture.data.url;
      user.isVerified = true;
      user.registrationCompleted = true;
      await user.save({ validateBeforeSave: false });
    } else if (user.facebookId !== id) {
      return next(new AppError(req.t("auth:emailAlreadyRegistered"), 400));
    }
  } else {
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
  }

  // Check if user has 2FA enabled
  if (user.is2FAEnabled) {
    await verificationHelper.send2FACode(user, req, next);
    return res.status(200).json({
      status: "success",
      message: req.t("auth:verificationCodeSent"),
      is2FA: user.is2FAEnabled,
      userId: user._id,
    });
  }

  // Send response with access token and refresh token
  return verificationHelper.sendTokensAndCookies(
    user,
    res,
    req.t("auth:loginSuccess"),
  );
});

/**
 * Login user with Google and send access token and refresh token to cookies.
 */
exports.googleAuth = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check if token is provided
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError(req.t("auth:noProvidedToken"), 400));
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return next(new AppError(req.t("auth:tokenRequired"), 400));
  }

  const response = await axios.get(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  // Get user details from Google
  const { sub, email, picture, given_name, family_name } = response.data;
  const highResPicture = picture ? picture.replace("s96-c", "s400-c") : "";

  // Check if user exists
  let user = await User.findOne({ email }).select(
    "+isVerified +registrationCompleted",
  );

  // Check if user exists and registration not completed
  if (user) {
    if (!user.registrationCompleted) {
      user.googleId = sub;
      user.firstName = given_name;
      user.lastName = family_name;
      user.profileImage = highResPicture;
      user.isVerified = true;
      user.registrationCompleted = true;
      await user.save({ validateBeforeSave: false });
    } else if (user.googleId !== sub) {
      return next(new AppError(req.t("auth:emailAlreadyRegistered"), 400));
    }
  } else {
    user = new User({
      googleId: sub,
      email,
      firstName: given_name,
      lastName: family_name,
      isVerified: true,
      registrationCompleted: true,
      profileImage: highResPicture,
    });
    await user.save({ validateBeforeSave: false });
  }

  // Check if user has 2FA enabled
  if (user.is2FAEnabled) {
    await verificationHelper.send2FACode(user, req, next);
    return res.status(200).json({
      status: "success",
      message: req.t("auth:verificationCodeSent"),
      is2FA: user.is2FAEnabled,
      userId: user._id,
    });
  } else {
    // Send response with access token and refresh token
    return verificationHelper.sendTokensAndCookies(
      user,
      res,
      req.t("auth:loginSuccess"),
    );
  }
});

/**
 * Refresh access token with refresh token.
 */
exports.refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return next(new AppError(req.t("auth:refreshTokenNotFound"), 401));
  }

  // Verify refresh token and get user
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

  // Check if user exists
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new AppError(req.t("auth:userNotFound"), 404));
  }

  // Send response with access token and refresh token
  return verificationHelper.sendTokensAndCookies(
    user,
    res,
    req.t("auth:tokenRefresh"),
  );
});

/**
 * Get current user details.
 */
exports.getCurrentUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return next(new AppError(req.t("auth:userNotFound"), 404));
  }

  // Send response with user details
  return res.status(200).json({
    status: "success",
    user,
  });
});

/**
 * Restrict access to specific roles and plans.
 */
exports.restrictTo =
  ({ roles = [], plans = [] }) =>
  (req, res, next) => {
    // Check if the user's role is allower
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new AppError(req.t("error.doNotHavePermission"), 403));
    }

    // Check if the user's plan is allowed
    if (plans.length && !plans.includes(req.user.plan)) {
      return next(
        new AppError(
          req.t("error.notEligibleForFeature", { plan: req.user.plan }),
          403,
        ),
      );
    }

    // If user is allowed, continue
    next();
  };
