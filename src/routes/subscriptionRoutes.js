const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  createCheckoutSession,
  createCustomerPortal,
  getSubscriptionDetails,
} = require("../controllers/subscriptionController");
const authController = require("../controllers/authController");
const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);
router.use(authController.restrictTo("admin", "supplier", "client"));
//
router.post("/create-portal-session", createCustomerPortal);
router.post("/create-checkout-session", createCheckoutSession);
router.get("/details", getSubscriptionDetails);

module.exports = router;
