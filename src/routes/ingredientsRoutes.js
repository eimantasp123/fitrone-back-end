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

const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);

// Restrict access to admin and supplier roles
router.use(authController.restrictTo("admin", "supplier"));

// Routes for ingredients
router.post("/", addIngredient);
router.get("/", getIngredients);
router.get("/search", getIngredientSearch);
router.post("/search-ai", getIngredientInfo);
router.get("/nutrition/:ingredientId", getIngredientNutrition);

//Not integrated yet
router.delete("/:ingredientId", deleteIngredient);
router.put("/:ingredientId", updateIngredient);

module.exports = router;
