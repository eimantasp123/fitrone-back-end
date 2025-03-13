const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  getUserLimitsBasedOnPlan,
} = require("../controllers/dashboardController");
const router = express.Router();

/**
 * Apply authentication middleware to all routes below this line
 */
router.use(authMiddleware);

// Route to get user limits based on plan
router.get("/", getUserLimitsBasedOnPlan);

module.exports = router;
