const { model } = require("mongoose");
const User = require("../models/User");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { createStripeCustomerIfNotExists } = require("../utils/stripeHelper");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Create a customer portal for the user
exports.createCustomerPortal = catchAsync(async (req, res, next) => {
  console.log("Creating customer portal");
  const user = await User.findById(req.user.id).select("+stripeCustomerId");
  let stripeCustomerId = user.stripeCustomerId;

  if (!user.stripeCustomerId) {
    const customerId = await createStripeCustomerIfNotExists(user);
    user.stripeCustomerId = customerId;
    stripeCustomerId = customerId;
    await user.save();
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/subscription`,
  });

  if (session.error) {
    return next(new AppError(session.error.message, 400));
  }

  res.status(200).json({
    status: "success",
    url: session.url,
  });
});

// Create chekout session for the user
exports.createCheckoutSession = catchAsync(async (req, res, next) => {
  const { priceId } = req.body;
  const user = await User.findById(req.user.id).select("+stripeCustomerId");

  //  Create a Stripe customer if it doesn't exist
  const customerId = await createStripeCustomerIfNotExists(user);

  // Check if the user has used the free trial
  const trialPeriodDays = user.hasUsedFreeTrial
    ? 0
    : process.env.TRIAL_PERIOD_DAYS || 14;

  // Check if the user is reactivating the subscription
  const isReactivating = [
    "canceled",
    "incomplete",
    "incomplete_expired",
  ].includes(user.subscriptionStatus);

  // Create a checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: isReactivating
      ? {}
      : {
          trial_period_days: trialPeriodDays,
        },
    success_url: `${process.env.FRONTEND_URL}/subscription`,
    cancel_url: `${process.env.FRONTEND_URL}/subscription`,
  });

  // Send the session URL to the client
  res.status(200).json({
    status: "success",
    url: session.url,
  });
});

// Get subscription details for the user
exports.getSubscriptionDetails = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select(
    "+stripeCustomerId +stripeSubscriptionId",
  );

  if (!user.stripeSubscriptionId || !user.stripeCustomerId) {
    return res.status(200).json({
      status: "success",
      data: {
        plan: "base",
        trialEnd: null,
        subscriptionCancelAtPeriodEnd: false,
        subscriptionCancelAt: null,
      },
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      trialEnd: user.trialEnd,
      subscriptionCancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
      subscriptionCancelAt: user.subscriptionCancelAt,
    },
  });
});
