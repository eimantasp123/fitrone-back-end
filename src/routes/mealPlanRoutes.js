const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  mealPlanCreate,
  restrictToPlan,
  mealPlanGet,
} = require("../controllers/mealPlanController");

const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);
//
router.post("/", restrictToPlan("basic", "pro", "premium"), mealPlanCreate);
router.get("/", restrictToPlan("basic", "pro", "premium"), mealPlanGet);

module.exports = router;
