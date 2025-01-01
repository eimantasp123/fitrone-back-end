const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const checkPlanFeatures = require("../middlewares/checkPlanFeatures");
const authController = require("../controllers/authController");
const { upload } = require("../controllers/mealsController");
const {
  addMeal,
  getMeals,
  deleteMeal,
  updateMeal,
  getMealById,
  searchMeals,
} = require("../controllers/mealsController");

const router = express.Router();

/**
 * Apply authentication middleware to all routes below this line
 */
router.use(authMiddleware);

/**
 * Restrict access to admin and supplier roles and to the basic, pro, and premium plans
 */
router.use(
  authController.restrictTo({
    roles: ["admin", "supplier"],
    plans: ["basic", "pro", "premium"],
  }),
);

/**
 * Routes for meals
 */

// Route to add a new meal
router.post(
  "/",
  checkPlanFeatures("meals", "meals_limit"),
  upload.single("image"),
  addMeal,
);

// Search meals
router.get("/search", searchMeals);

// Route to get all meals
router.get("/", getMeals);

// Route to get a meal by ID
router.get("/:id", getMealById);

// Route to update a meal
router.put("/:id", upload.single("image"), updateMeal);

// Route to delete a meal
router.delete("/:id", deleteMeal);

module.exports = router;
