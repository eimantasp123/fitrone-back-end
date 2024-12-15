const express = require("express");
const {
  registerEmail,
  verifyEmail,
  completeRegistration,
  resendVerificationEmailCode,
  facebookAuth,
  googleAuth,
  login,
  verifyLogin,
  resendCode,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  getCurrentUser,
  restrictTo,
} = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * Routes for authentication
 */
router.post("/register-email", registerEmail);
router.post("/verify-email/", verifyEmail);
router.post("/complete-registration", completeRegistration);
router.post("/resend-email-verify-code", resendVerificationEmailCode);
//
router.post("/facebook", facebookAuth);
router.post("/google", googleAuth);
//
router.post("/login", login);
router.post("/verify-login", verifyLogin);
router.post("/resend-code", resendCode);
//
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
//
router.get("/refresh-token", refreshToken);

/**
 * Apply authentication middleware to all routes below this line
 */
router.use(authMiddleware);

/**
 * Restrict access to admin and supplier roles and to the basic, pro, and premium plans
 */
router.use(
  restrictTo({
    roles: ["admin", "supplier"],
    plans: ["base", "basic", "pro", "premium"],
  }),
);

// Route to logout
router.post("/logout", logout);

// Route to get current user
router.get("/user", getCurrentUser);

module.exports = router;
