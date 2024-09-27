const User = require("../models/User");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Create a payment method
exports.createPaymentMethod = catchAsync(async (req, res, next) => {
  const { paymentMethodId } = req.body;

  // Check if the payment method ID is provided
  if (!paymentMethodId) {
    return next(new AppError("Payment method ID is required", 400));
  }

  // Retrieve the user from the database
  const user = await User.findById(req.user.id).select("+stripeCustomerId");
  const customerId = await createStripeCustomerIfNotExists(user);

  // Attach the payment method to the customer
  await attachPaymentMethodToCustomer(paymentMethodId, customerId);

  // Retrieve the customer from Stripe
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer.invoice_settings.default_payment_method) {
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }
  // Format the payment methods
  const formattedPaymentMethods = await getFormattedPaymentMethods(customerId);
  // Respond with the payment methods
  res.status(201).json({
    status: "success",
    data: formattedPaymentMethods,
  });
});

// Get all payment methods for the user
exports.getPaymentMethods = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+stripeCustomerId");

  if (!user.stripeCustomerId) {
    return next(new AppError("No payment methods found", 404));
  }

  // Get all payment methods for the customer
  const formattedPaymentMethods = await getFormattedPaymentMethods(
    user.stripeCustomerId,
  );

  res.status(200).json({
    status: "success",
    data: formattedPaymentMethods,
  });
});

// Remove a payment method
exports.deletePaymentMethod = catchAsync(async (req, res, next) => {
  const { paymentMethodId } = req.body;
  if (!paymentMethodId) {
    return next(new AppError("Payment method ID is required", 400));
  }

  const user = await User.findById(req.user.id).select("+stripeCustomerId");
  if (!user.stripeCustomerId) {
    return next(new AppError("No payment methods found", 404));
  }

  // Retrieve the customer from Stripe
  const customer = await stripe.customers.retrieve(user.stripeCustomerId);

  // Check if the payment method is the default
  const defaultPaymentMethodId =
    customer.invoice_settings.default_payment_method;

  // If the payment method is the default, remove it from the customer
  if (defaultPaymentMethodId === paymentMethodId) {
    return next(
      new AppError("You cannot delete your default payment method", 400),
    );
  }

  // Detach the payment method from the customer
  await stripe.paymentMethods.detach(paymentMethodId);

  // Get all payment methods for the customer
  const formattedPaymentMethods = await getFormattedPaymentMethods(
    user.stripeCustomerId,
  );

  res.status(200).json({
    status: "success",
    message: "Payment method removed successfully",
    data: formattedPaymentMethods,
  });
});

// Set a default payment method
exports.setDefaultPaymentMethod = catchAsync(async (req, res, next) => {
  const { paymentMethodId } = req.body;
  if (!paymentMethodId) {
    return next(new AppError("Payment method ID is required", 400));
  }

  const user = await User.findById(req.user.id).select("+stripeCustomerId");
  if (!user.stripeCustomerId) {
    return next(new AppError("No payment methods found", 404));
  }

  // Set the payment method as the default for the customer
  await stripe.customers.update(user.stripeCustomerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  // Get all payment methods for the customer
  const formattedPaymentMethods = await getFormattedPaymentMethods(
    user.stripeCustomerId,
  );

  res.status(200).json({
    status: "success",
    message: "Default payment method updated successfully",
    data: formattedPaymentMethods,
  });
});

// Create a Stripe customer if it doesn't exist
const createStripeCustomerIfNotExists = async (user) => {
  if (!user.stripeCustomerId) {
    console.log("Creating a Stripe customer");
    const customer = await stripe.customers.create({
      email: user.email,
    });
    user.stripeCustomerId = customer.id;
    await user.save();
  }
  return user.stripeCustomerId;
};

// Attach the payment method to the customer
const attachPaymentMethodToCustomer = catchAsync(
  async (paymentMethodId, customerId) => {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  },
);

// Retrieve all payment methods and their default status
const getFormattedPaymentMethods = async (customerId) => {
  // Retrieve the customer from Stripe
  const customer = await stripe.customers.retrieve(customerId);
  const defaultPaymentMethodId =
    customer.invoice_settings.default_payment_method;

  // Get all payment methods for the customer
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });

  // Format the payment methods
  return paymentMethods.data.map((paymentMethod) =>
    formatPaymentMethodData(
      paymentMethod,
      paymentMethod.id === defaultPaymentMethodId,
    ),
  );
};

// Format the payment method data
const formatPaymentMethodData = (paymentMethod, isDefault) => ({
  paymentMethodId: paymentMethod.id,
  cardBrand: paymentMethod.card.brand,
  last4: paymentMethod.card.last4,
  expMonth: paymentMethod.card.exp_month,
  expYear: paymentMethod.card.exp_year,
  isDefault: isDefault,
});
