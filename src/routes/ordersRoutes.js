const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  getOrders,
  getOrderById,
  changeMealStatus,
  changeOrderStatus,
  getIngredientsLists,
  enterIngredientStock,
  createCombinedIngredientsList,
  generateIngredientsPdf,
  deleteSingleDayIngredientStock,
  deleteCombinedIngredientsList,
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

// Generate pdf for combined ingredients list
router.get("/generate-ingredients-pdf", generateIngredientsPdf);

// Enter ingredient stock for the day
router.patch("/ingredients/enter-stock", enterIngredientStock);

// Remove ingredient stock from current day stock list
router.patch("/:id/ingredients/remove-stock", deleteSingleDayIngredientStock);

// Delete combined ingredients list
router.patch(
  "/:id/ingredients/delete-combined-list",
  deleteCombinedIngredientsList,
);

// Get orders by provided year and week number
router.get("/", getOrders);

// Change status of single day order meal
router.patch("/change-status/:id", changeMealStatus);

// Get single day order by id
router.get("/:id", getOrderById);

// Change status of single day order
router.patch("/:id", changeOrderStatus);

module.exports = router;
