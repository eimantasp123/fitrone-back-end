require("dotenv").config();
const mailgun = require("mailgun-js");

const mg = mailgun({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
});

const sendPasswordResetEmail = async (to, token) => {
  console.log("Sending password reset email to:", to);
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  const data = {
    from: "Excited User <mailgun@sandboxfdeb6d3929ff4479a5eb9222bc67a722.mailgun.org>",
    to,
    subject: "Password Reset",
    text: `You requested a password reset. Click the link to reset your password: ${resetUrl}`,
    html: `<strong>You requested a password reset. Click the link to reset your password: <a href="${resetUrl}">${resetUrl}</a></strong>`,
  };

  try {
    await mg.messages().send(data);
    console.log("Password reset email sent successfully");
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

const sendVerificationEmail = async (to, token) => {
  const verificationUrl = `${process.env.BACKEND_URL}/verify/${token}`;
  const data = {
    from: "Excited User <mailgun@sandboxfdeb6d3929ff4479a5eb9222bc67a722.mailgun.org>",
    to,
    subject: "Account Verification",
    text: `Click the link to verify your account: ${verificationUrl}`,
    html: `<strong>Click the link to verify your account: <a href="${verificationUrl}">${verificationUrl}</a></strong>`,
  };

  try {
    await mg.messages().send(data);
    console.log("Verification email sent successfully");
    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendPasswordResetEmail, sendVerificationEmail };
