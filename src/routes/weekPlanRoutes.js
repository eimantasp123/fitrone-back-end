const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
const checkPlanFeatures = require("../middlewares/checkPlanFeatures");
const router = express.Router();
const {
  createWeekPlan,
  setUserTimezone,
  getWeekPlanByDate,
} = require("../controllers/weekPlanController");

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
 * Routes for week plans
 */
router.post(
  "/",
  // checkPlanFeatures("weekPlans", "meal_week_types_limit"),
  createWeekPlan,
);

// Set user timezone
router.patch("/set-timezone", setUserTimezone);

// Get week plan by date
router.get("/", getWeekPlanByDate);

module.exports = router;
