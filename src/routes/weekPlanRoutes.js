const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
const checkPlanFeatures = require("../middlewares/checkPlanFeatures");
const router = express.Router();
const {
  setUserTimezone,
  assignMenu,
  assignClient,
  assignGroup,
  getWeekPlanByDateAndCreate,
  deleteAssignedMenu,
  managePublishMenu,
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
// Set user timezone
router.patch("/set-timezone", setUserTimezone);

// Get week plan by date and create on mount
router.get("/", getWeekPlanByDateAndCreate);

// Assign menu to week plan
router.patch(
  "/:id/assign-menu", // checkPlanFeatures("weekPlans", "meal_week_types_limit"),
  assignMenu,
);

// Delete assigned menu from week plan
router.delete("/delete-menu", deleteAssignedMenu);

// Manage publish week plan menu
router.patch("/manage-publish-menu", managePublishMenu);

// Assign client to week plan
router.patch("/:id/assign-client", assignClient);

// Assign group to week plan
router.patch("/:id/assign-group", assignGroup);

module.exports = router;
