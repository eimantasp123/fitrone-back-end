const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
const profileController = require("../controllers/profileController");

const router = express.Router();
router.use(authMiddleware);
router.use(authController.restrictTo("admin", "trainer", "client"));

router.patch(
  "/image",
  profileController.upload.single("image"),
  profileController.uploadImage,
);
router.delete("/image", profileController.deleteImage);
router.patch("/details", profileController.updateProfileDetails);
router.patch("/password", profileController.updateProfilePassword);
router.put("/2fa/request", profileController.request2FACode);
router.put("/2fa/verify", profileController.verify2FACode);
router.delete("/account", profileController.deleteAccount);

module.exports = router;
