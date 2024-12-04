const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
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

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);

// Restrict access to admin and supplier roles
router.use(authController.restrictTo("admin", "supplier"));

//
//
// Routes for ingredients and check plan features
//
//

// Add a new ingredient
router.post(
  "/",
  checkPlanFeatures("ingredients", "ingredients_limit"),
  addIngredient,
);

// Get all ingredients
router.get("/", getIngredients);

// Get ingredient search results
router.get("/search", getIngredientSearch);

// Get ingredient info from AI
router.post("/search-ai", getIngredientInfo);

// Get ingredient nutrition info
router.get("/nutrition/:ingredientId", getIngredientNutrition);

// Get ingredient by ID
router.delete("/:ingredientId", deleteIngredient);

// Update ingredient by ID
router.put("/:ingredientId", updateIngredient);

module.exports = router;
