const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  getOrders,
  getOrderById,
  changeMealStatus,
  changeOrderStatus,
  getIngredientsLists,
  enterSingleDayIngredientStock,
  createCombinedIngredientsList,
} = require("../controllers/ordersController");

const router = express.Router();

/**
 * Apply authentication middleware to all routes below this line
 */
router.use(authMiddleware);

// Get ingredients lists for each day of the week
router.get("/ingredients-list", getIngredientsLists);

// Create a new combined ingredients list document
router.post("/ingredients-list-combo", createCombinedIngredientsList);

// Enter ingredient stock for the day
router.patch("/:id/ingredients/enter-stock", enterSingleDayIngredientStock);

// Get orders by provided year and week number
router.get("/", getOrders);

// Change status of single day order meal
router.patch("/change-status/:id", changeMealStatus);

// Get single day order by id
router.get("/:id", getOrderById);

// Change status of single day order
router.patch("/:id", changeOrderStatus);

module.exports = router;
