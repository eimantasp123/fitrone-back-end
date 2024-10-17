const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  mealPlanBalance,
  mealPlanGet,
  updateMealPlanBalance,
} = require("../controllers/mealPlanController");

const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);
//
router.post("/balance", mealPlanBalance);
router.put("/balance", updateMealPlanBalance);
router.get("/", mealPlanGet);

module.exports = router;
