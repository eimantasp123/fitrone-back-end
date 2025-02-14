const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const { createOrder } = require("../controllers/ordersController");

const router = express.Router();

/**
 * Apply authentication middleware to all routes below this line
 */
router.use(authMiddleware);

// Route to submit feedback
router.post("/", createOrder);

module.exports = router;
