const sendEmail = require("../utils/email");
const setAuthCookies = require("../utils/setAuthCookies");
const generateTokens = require("../utils/tokenUtils");
const AppError = require("../utils/appError");
const { sendMessageToQueue } = require("../utils/awsHelper");

// Handle sending password reset email
exports.handleSendPasswordResetEmail = async (user, res, next) => {
  try {
    await sendMessageToQueue(
      { userId: user._id },
      process.env.EMAIL_VERIFY_CODE_SQS_URL,
    );
    res.status(200).json({
      status: "success",
      message: "Reset password email sent successfully",
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return next(
      new AppError(
        "There was an error sending the password reset email. Try again later",
        500,
      ),
    );
  }
};

// Send password reset email from SQS message
exports.sendPasswordResetEmail = async (user) => {
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
    console.error("Error sending password reset email:", error);
  }
};

// Send 2FA code to user
exports.send2FACode = async (user, next) => {
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
    console.log("2FA code sent successfully", code);
    return await user.save({ validateBeforeSave: false });
  } catch (error) {
    console.error("Error sending 2FA code:", error);
    return next(
      new AppError(
        "There was an error sending the 2FA code. Try again later",
        500,
      ),
    );
  }
};

// Handle sending email verification code
exports.handleVerificationEmailSending = async (user, res, next) => {
  try {
    await sendMessageToQueue({ userId: user._id }, process.env.EMAIL_SQS_URL);
    //
    res.status(200).json({
      status: "success",
      message:
        "Enter the verification code from the email in your inbox or spam folder sent to",
      email: user.email,
    });
  } catch (error) {
    console.error("Error sending verification email:", error);
    return next(
      new AppError(
        "There was an error sending the email. Try again later",
        500,
      ),
    );
  }
};

// Send email verification code to user email from SQS message
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
    console.error("Error sending email verification code:", error);
  }
};

// Helper function to send tokens and cookies
exports.sendTokensAndCookies = (user, res, message) => {
  const { token: accessToken, refreshToken } = generateTokens(user._id);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(200).json({
    status: "success",
    message,
  });
};
