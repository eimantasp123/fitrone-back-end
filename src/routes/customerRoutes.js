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
  changeCustomerStatusToInactive,
  changeCustomerStatusToActive,
  calculateRecommendedNutrition,
  changeCustomerMenuQuantity,
  checkDoesCustomerExistInWeeklyPlan,
} = require("../controllers/customerController");
const checkPlanFeatures = require("../middlewares/checkPlanFeatures");
const { restrictTo } = require("../controllers/authController");
const router = express.Router();

// Confirm customer form
router.post("/confirm-form/:token", confirmCustomerForm);

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

// Delete a customer
router.delete("/:id", deleteCustomer);

// Update a customer
router.put("/:id", updateCustomer);

// Get all customers
router.get("/", getAllCustomers);

// Change customer status to inactive
router.patch(
  "/:id/change-status/inactive",
  checkDoesCustomerExistInWeeklyPlan,
  changeCustomerStatusToInactive,
);

// Change customer status to active
router.patch(
  "/:id/change-status/active",
  checkPlanFeatures("customers", "clients_limit"),
  checkDoesCustomerExistInWeeklyPlan,
  changeCustomerStatusToActive,
);

// Change customer menu quantity
router.patch("/:id/change-menu-quantity", changeCustomerMenuQuantity);

// Calculate nutrition for a customer
router.post("/:id/calculate-nutrition", calculateRecommendedNutrition);

module.exports = router;
