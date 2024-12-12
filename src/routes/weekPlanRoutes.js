const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
const checkPlanFeatures = require("../middlewares/checkPlanFeatures");
const router = express.Router();
const {
  createWeekPlan,
  addMealToDay,
  updateWeekPlan,
  deleteWeekPlan,
  removeMealFromDay,
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
  checkPlanFeatures("weekPlans", "meal_week_types_limit"),
  createWeekPlan,
);
router.patch("/:weekPlanId", updateWeekPlan);
router.delete("/:weekPlanId", deleteWeekPlan);
// router.get("/:weekPlanId", getWeekPlanById);

// Add meal to a day in a current week plan
router.post("/:weekPlanId/add-meal", addMealToDay);
router.delete("/:weekPlanId/remove-meal", removeMealFromDay);

module.exports = router;
