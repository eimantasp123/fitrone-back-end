const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
const { upload } = require("../controllers/mealsController");
const {
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

router.post("/", upload.single("image"), addMeal);
router.get("/", getMeals);
router.delete("/", deleteMeal);
router.put("/:id", upload.single("image"), updateMeal);

module.exports = router;
