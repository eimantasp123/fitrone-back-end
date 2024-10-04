const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  mealPlanBalance,
  restrictToPlan,
  mealPlanGet,
  mealPlanGenerate,
  getRecipeDetails,
} = require("../controllers/mealPlanController");

const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);
//
router.post(
  "/balance",
  restrictToPlan("basic", "pro", "premium"),
  mealPlanBalance,
);
router.get("/", restrictToPlan("basic", "pro", "premium"), mealPlanGet);
// router.post(
//   "/generate-meal-plan",
//   restrictToPlan("basic", "pro", "premium"),
//   mealPlanGenerate,
// );

// router.get(
//   "/get-recipe-details",
//   restrictToPlan("basic", "pro", "premium"),
//   getRecipeDetails,
// );

module.exports = router;
