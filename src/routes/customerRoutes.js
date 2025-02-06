const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  createCustomerManually,
  sendFormToCustomer,
  resendFormToCustomer,
  confirmCustomerForm,
  deleteCustomer,
  updateCustomer,
  getAllCustomers,
  changeCustomerStatus,
  calculateRecommendedNutrition,
} = require("../controllers/customerController");
const checkPlanFeatures = require("../middlewares/checkPlanFeatures");
const { restrictTo } = require("../controllers/authController");
const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);

// Create a new customer manually
router.post(
  "/",
  checkPlanFeatures("customers", "clients_limit"),
  createCustomerManually,
);

// Send form to customer
router.post(
  "/send-form",
  restrictTo({ plans: ["pro", "premium"] }),
  checkPlanFeatures("customers", "clients_limit"),
  sendFormToCustomer,
);

// Resend form to customer
router.post(
  "/resend-form",
  restrictTo({ plans: ["pro", "premium"] }),
  resendFormToCustomer,
);

// Confirm customer form
router.post("/confirm-form/:token", confirmCustomerForm);

// Delete a customer
router.delete("/:id", deleteCustomer);

// Update a customer
router.put("/:id", updateCustomer);

// Get all customers
router.get("/", getAllCustomers);

// Change customer status
router.patch("/:id/change-status", changeCustomerStatus);

// Calculate nutrition for a customer
router.post("/:id/calculate-nutrition", calculateRecommendedNutrition);

module.exports = router;
