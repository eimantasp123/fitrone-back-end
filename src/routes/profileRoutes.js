const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const { restrictTo } = require("../controllers/authController");
const {
  upload,
  uploadImage,
  deleteImage,
  updateProfileDetails,
  updateProfilePassword,
  request2FACode,
  verify2FACode,
  deleteAccount,
  updateBusinessName,
} = require("../controllers/profileController");

const router = express.Router();

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

/**
 * Routes for updating the user profile
 */

// Route to upload a profile image
router.patch("/image", upload.single("image"), uploadImage);

// Route to delete a profile image
router.delete("/image", deleteImage);

// Route to update profile details
router.patch("/details", updateProfileDetails);

// Route to update the user password
router.patch("/password", updateProfilePassword);

// Route to request a 2FA code
router.put("/2fa/request", request2FACode);

// Route to verify a 2FA code
router.put("/2fa/verify", verify2FACode);

// Update business name
router.patch("/business-name", updateBusinessName);

// Route to delete the user account
router.delete("/account", deleteAccount);

module.exports = router;
