const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
const { getIngredientInfo } = require("../controllers/mealsController");

const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);
// Restrict access to admin and supplier roles
router.use(authController.restrictTo("admin", "supplier"));

router.post("/ingredient", getIngredientInfo);

module.exports = router;
