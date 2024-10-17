const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const authController = require("../controllers/authController");
const {
  createPaymentMethod,
  getPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
} = require("../controllers/paymentController");
const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);
//
router.use(authController.restrictTo("admin", "supplier", "client"));
//
router.post("/add-payment-method", createPaymentMethod);
router.get("/get-payment-methods", getPaymentMethods);
router.post("/delete-payment-method", deletePaymentMethod);
router.post("/set-default-payment-method", setDefaultPaymentMethod);

module.exports = router;
