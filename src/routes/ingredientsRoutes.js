const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const { restrictTo } = require("../controllers/authController");
const {
  getIngredientInfo,
  addIngredient,
  getIngredientSearch,
  getIngredientNutrition,
  getIngredients,
  deleteIngredient,
  updateIngredient,
} = require("../controllers/ingredientsController");
const checkPlanFeatures = require("../middlewares/checkPlanFeatures");

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
    plans: ["basic", "pro", "premium"],
  }),
);

// Add a new ingredient
router.post(
  "/",
  checkPlanFeatures("ingredients", "ingredients_limit"),
  addIngredient,
);

// Get all ingredients
router.get("/", getIngredients);

// Update ingredient by ID
router.put("/:ingredientId", updateIngredient);

// Delete ingredient by ID
router.delete("/:ingredientId", deleteIngredient);

// Get ingredient search results from user database
router.get("/search", getIngredientSearch);

// Get ingredient info from AI
router.post(
  "/search-ai",
  restrictTo({ plans: ["pro", "premium"] }),
  getIngredientInfo,
);

// Get ingredient nutrition info
router.get("/nutrition/:ingredientId", getIngredientNutrition);

module.exports = router;
