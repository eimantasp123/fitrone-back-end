const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
const {
  getIngredientInfo,
  addIngredient,
  getIngredientSearch,
  addMeal,
  getMeals,
  deleteMeal,
  updateMeal,
} = require("../controllers/mealsController");

const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);

// Restrict access to admin and supplier roles
router.use(authController.restrictTo("admin", "supplier"));

// Route to get ingredient information
router.post("/ingredient", getIngredientInfo);
router.post("/add-ingredient", addIngredient);
router.get("/ingredient-search", getIngredientSearch);
router.post("/add-meal", addMeal);
router.get("/", getMeals);
router.delete("/", deleteMeal);
router.put("/:id", updateMeal);

module.exports = router;
