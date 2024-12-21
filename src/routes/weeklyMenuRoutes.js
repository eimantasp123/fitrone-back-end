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

// Get all weekly menus
router.get("/", getAllWeeklyMenus);

// Create a new weekly menu
router.post("/", createWeeklyMenu);

// Update the bio of a weekly menu
router.patch("/:id", updateWeeklyMenuBio);

// Delete a weekly menu
router.delete("/:id", deleteWeeklyMenu);

// Get a weekly menu by ID
router.get("/:id", getWeeklyMenuById);

// Add a meal to a weekly menu
router.post("/:id/meal", addMealToWeeklyMenu);

// Remove a meal from a weekly menu
router.delete("/:id/meal", removeMealFromWeeklyMenu);

module.exports = router;
