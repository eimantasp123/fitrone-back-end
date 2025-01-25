const setAuthCookies = require("../utils/setAuthCookies");
const generateTokens = require("../utils/tokenUtils");
const AppError = require("../utils/appError");
const { sendMessageToQueue, sendSMS } = require("../utils/awsHelper");

// Handle sending password reset email
exports.handleSendPasswordResetEmail = async (user, res, req, next) => {
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  //
  const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  try {
    const messageBody = {
      // email: user.email,
      email: "no-reply@fitrone.com",
      template: "reset-password-email",
      data: {
        subject: req.t("auth:emailPasswordReset.subject"),
        emailTitle: req.t("auth:emailPasswordReset.emailTitle"),
        paragraph1: req.t("auth:emailPasswordReset.paragraph1"),
        buttonText: req.t("auth:emailPasswordReset.subject"),
        url: resetURL,
      },
    };

    // Send email verification code to user email
    await sendMessageToQueue(
      messageBody,
      process.env.EMAIL_RESET_PASSWORD_SQS_URL,
    );
    //
    return res.status(200).json({
      status: "success",
      message: req.t("auth:resetPasswordTokenSend", { email: user.email }),
      description: req.t("auth:resetPasswordTokenSendDescription", {
        email: user.email,
      }),
      email: user.email,
    });
  } catch (error) {
    return next(new AppError(req.t("auth:error.sendingEmail"), 500));
  }
};

// Handle sending email verification code
exports.handleVerificationEmailSending = async (user, res, req, next) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  user.emailVerificationCode = code;
  user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save({ validateBeforeSave: false });

  try {
    const messageBody = {
      // email: user.email,
      email: "no-reply@fitrone.com",
      template: "email-verification-code",
      data: {
        subject: req.t("auth:emailVerification.subject"),
        emailTitle: req.t("auth:emailVerification.emailTitle"),
        paragraph1: req.t("auth:emailVerification.paragraph1"),
        code,
      },
    };

    // Send email verification code to user email
    await sendMessageToQueue(messageBody, process.env.EMAIL_SQS_URL);
    //
    return res.status(200).json({
      status: "success",
      message: req.t("auth:verifyEmailSendSuccessfuly", { email: user.email }),
      email: user.email,
    });
  } catch (error) {
    return next(new AppError(req.t("auth:error.sendingEmail"), 500));
  }
};

// Send 2FA code to user
exports.send2FACode = async (user, req, next) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  user.twoFactorCode = code;
  user.twoFactorExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save({ validateBeforeSave: false });

  // Create message to send to user
  const message = req.t("auth:verificationCodeIs", { code });
  try {
    console.log("sending sms", user.phone, message);
    await sendSMS(user.phone, message);
  } catch (error) {
    return next(new AppError(req.t("auth:error.sending2FA"), 500));
  }
};

// Helper function to send tokens and cookies
exports.sendTokensAndCookies = (user, res, message) => {
  const { token: accessToken, refreshToken } = generateTokens(user._id);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(200).json({
    status: "success",
    message: message,
  });
};
