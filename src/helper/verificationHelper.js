const sendEmail = require("../utils/email");
const setAuthCookies = require("../utils/setAuthCookies");
const generateTokens = require("../utils/tokenUtils");
const AppError = require("../utils/appError");
const { sendMessageToQueue } = require("../utils/awsHelper");

// Send password reset email
exports.sendPasswordResetEmail = async (user, req, next) => {
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  //
  const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  const message = `Click this link to reset your password: ${resetURL}`;
  //
  try {
    await sendEmail({
      email: user.email,
      subject: "Reset your password",
      message,
    });
  } catch (error) {
    // If there was an error sending the email, remove reset password fields
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        "There was an error sending the email. Try again later",
        500,
      ),
    );
  }
};

// Send 2FA code to user
exports.send2FACode = async (user) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  // Send code to user
  try {
    await sendMessageToQueue(
      {
        phone: user.phone,
        code,
      },
      process.env.SMS_SQS_URL,
    );
    //
    user.twoFactorCode = code;
    user.twoFactorExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });
  } catch (error) {
    console.error("Error sending 2FA code:", error);
  }
};

// Handle sending email verification code
exports.handleVerificationEmailSending = async (user, res) => {
  await sendMessageToQueue({ userId: user._id }, process.env.EMAIL_SQS_URL);

  return res.status(200).json({
    status: "success",
    message:
      "Enter the verification code from the email in your inbox or spam folder sent to",
    email: user.email,
  });
};

// Send email verification code to user email
exports.sendEmailVerifyCodeToEmail = async (user) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  user.emailVerificationCode = code;
  user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  await user.save({ validateBeforeSave: false });

  // Send verification code to user email
  const message = `Your email verification code is ${code}`;
  try {
    await sendEmail({
      email: user.email,
      subject: "Email verification code",
      message,
    });
  } catch (error) {
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        "There was an error sending the email. Try again later",
        500,
      ),
    );
  }
};

// Helper function to send tokens and cookies
exports.sendTokensAndCookies = async (user, res, message) => {
  const { token: accessToken, refreshToken } = generateTokens(user._id);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(200).json({
    status: "success",
    message,
  });
};
