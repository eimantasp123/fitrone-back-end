const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// Public Auth routes
router.post("/register-email", authController.registerEmail);
router.post("/verify-email/", authController.verifyEmail);
router.post("/complete-registration", authController.completeRegistration);
router.post(
  "/resend-email-verify-code",
  authController.resendVerificationEmailCode,
);
//
router.post("/facebook", authController.facebookAuth);
router.post("/google", authController.googleAuth);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
//
router.post("/verify-login", authController.verifyLogin);
router.post("/resend-code", authController.resendCode);
//
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);
//
router.get("/refresh-token", authController.refreshToken);

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);

// Protected routes
router.get(
  "/user",
  authController.restrictTo("admin", "trainer", "client"),
  authController.getCurrentUser,
);

module.exports = router;
