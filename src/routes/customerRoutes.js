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
} = require("../controllers/customerController");
const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);

// Create a new customer manually
router.post("/", createCustomerManually);

// Send form to customer
router.post("/send-form", sendFormToCustomer);

// Resend form to customer
router.post("/resend-form", resendFormToCustomer);

// Confirm customer form
router.post("/confirm-form/:token", confirmCustomerForm);

// Delete a customer
router.delete("/:id", deleteCustomer);

// Update a customer
router.put("/:id", updateCustomer);

// Get all customers
router.get("/", getAllCustomers);

module.exports = router;
