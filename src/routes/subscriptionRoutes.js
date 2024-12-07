const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  createCheckoutSession,
  createCustomerPortal,
  getSubscriptionDetails,
  markArchivedDataAsRead,
} = require("../controllers/subscriptionController");
const authController = require("../controllers/authController");
const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);
router.use(authController.restrictTo("admin", "supplier"));
//
router.post("/create-portal-session", createCustomerPortal);
router.post("/create-checkout-session", createCheckoutSession);
router.get("/details", getSubscriptionDetails);

// Restrict access to the basic, pro, and premium plans only
router.use(
  authController.restrictTo({
    plans: ["basic", "pro", "premium"],
  }),
);

//
router.put("/archived-data/read", markArchivedDataAsRead);

module.exports = router;
