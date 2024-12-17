const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
const checkPlanFeatures = require("../middlewares/checkPlanFeatures");
const router = express.Router();
const {
  createWeeklyMenu,
  updateWeeklyMenu,
} = require("../controllers/weeklyMenuController");

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);

// Restrict access to admin and supplier roles
router.use(
  authController.restrictTo({
    roles: ["admin", "supplier"],
    plans: ["basic", "pro", "premium"],
  }),
);

/**
 * Routes for weekly menu creation and management
 */

// Create weekly menu
router.post("/", createWeeklyMenu);
router.patch("/:id", updateWeeklyMenu);

module.exports = router;
