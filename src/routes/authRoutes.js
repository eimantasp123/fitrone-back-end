const express = require("express");
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/register", authController.register);
router.post("/facebook", authController.facebookAuth);
router.post("/google", authController.googleAuth);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.post("/verify-login", authController.verifyLogin);
router.post("/resend-code", authController.resendCode);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/refresh-token", authController.refreshToken);
router.get("/user", authMiddleware, userController.getCurrentUser);

module.exports = router;
