const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
const checkPlanFeatures = require("../middlewares/checkPlanFeatures");
const router = express.Router();
const {
  setUserTimezone,
  assignMenu,
  assignClients,
  assignGroup,
  getWeekPlanByDateAndCreate,
  deleteAssignedMenu,
  managePublishMenu,
  checkWeekPlanAndMenuAssigned,
  removeClient,
  removeGroup,
  getWeekPlanAssignedMenuDetails,
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
router.patch(
  "/:id/assign-clients",
  checkWeekPlanAndMenuAssigned,
  assignClients,
);

// Remove client from week plan
router.patch("/:id/remove-client", checkWeekPlanAndMenuAssigned, removeClient);

// Assign group to week plan
router.patch("/:id/assign-group", checkWeekPlanAndMenuAssigned, assignGroup);

// Remove group from week plan
router.patch("/:id/remove-group", checkWeekPlanAndMenuAssigned, removeGroup);

// Get week plan menu details
router.get("/:id/menu-details/:menuId", getWeekPlanAssignedMenuDetails);

module.exports = router;
