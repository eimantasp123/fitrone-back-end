const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
const checkPlanFeatures = require("../middlewares/checkPlanFeatures");
const router = express.Router();
const {
  createWeeklyMenu,
  updateWeeklyMenuBio,
  deleteWeeklyMenu,
  getAllWeeklyMenus,
  getWeeklyMenuById,
  addMealToWeeklyMenu,
  removeMealFromWeeklyMenu,
  archiveWeeklyMenu,
  unarchiveWeeklyMenu,
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

// Create a new weekly menu
router.post(
  "/",
  checkPlanFeatures("weeklyMenus", "weekly_menus_limit"),
  createWeeklyMenu,
);

// Update the bio of a weekly menu
router.patch("/:id", updateWeeklyMenuBio);

// Delete a weekly menu
router.delete("/:id", deleteWeeklyMenu);

// Archive a weekly menu
router.patch("/archive/:id", archiveWeeklyMenu);

// Unarchive a weekly menu
router.patch(
  "/unarchive/:id",
  checkPlanFeatures("weeklyMenus", "weekly_menus_limit"),
  unarchiveWeeklyMenu,
);

// Get a weekly menu by ID
router.get("/:id", getWeeklyMenuById);

// Get all weekly menus
router.get("/", getAllWeeklyMenus);

// Add a meal to a weekly menu
router.post("/:id/meal", addMealToWeeklyMenu);

// Remove a meal from a weekly menu
router.delete("/:id/meal", removeMealFromWeeklyMenu);

module.exports = router;
