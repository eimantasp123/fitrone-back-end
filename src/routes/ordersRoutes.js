const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  getOrders,
  getOrderById,
  changeMealStatus,
  changeOrderStatus,
  getIngredientsLists,
} = require("../controllers/ordersController");

const router = express.Router();

/**
 * Apply authentication middleware to all routes below this line
 */
router.use(authMiddleware);

// Get orders by provided year and week number
router.get("/", getOrders);

// Get ingredients lists for each day of the week
router.get("/ingredients-list", getIngredientsLists);

// Change status of single day order meal
router.patch("/change-status/:id", changeMealStatus);

// Get single day order by id
router.get("/:id", getOrderById);

// Change status of single day order
router.patch("/:id", changeOrderStatus);

module.exports = router;
