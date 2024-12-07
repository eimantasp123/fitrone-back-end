const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bodyParser = require("body-parser");
const User = require("../models/User");
const { downgradePlanHandler } = require("../helper/downgradeHelpers");
const mapPriceIdToPlan = require("./generalHelpers");
const UserIngredient = require("../models/UserIngredient");
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const router = express.Router();

// Use the raw body to validate the event
router.post(
  "/",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
        const customer = event.data.object;
        await handleCustomerCreation(customer);
        break;
      case "customer.subscription.updated":
        const subscriptionUpdates = event.data.object;
        await handleSubscriptionUpdates(subscriptionUpdates);
        break;
      case "customer.subscription.deleted":
        const subscription = event.data.object;
        await handleSubscriptionDeletion(subscription);
        break;
      case "charge.failed":
        const charge = event.data.object;
        await handleChargeFailed(charge);
        break;
      default:
        null;
    }
    res.status(200).json({ received: true });
  },
);

// Handle customer creation
async function handleCustomerCreation(customer) {
  const { customer: customerId, trial_end, status, items, id, plan } = customer;

  // Find the user based on the customer ID
  const user = await User.findOne({
    stripeCustomerId: customerId,
  }).select("+stripeCustomerId");

  if (!user) return;

  if (status === "trialing" && trial_end) {
    user.trialEnd = new Date(customer.trial_end * 1000);
  } else {
    user.trialEnd = null;
  }

  if (["incomplete", "incomplete_expired"].includes(status)) {
    user.subscriptionStatus = status;
    user.plan = "base";
  } else {
    user.plan = mapPriceIdToPlan(plan.id || items.data[0].price.id);
    user.subscriptionStatus = status;
  }
  user.hasUsedFreeTrial = true;
  user.stripeSubscriptionId = id;
  await user.save();
}

// Handle subscription updates
async function handleSubscriptionUpdates(subscriptionUpdates) {
  const {
    customer,
    status,
    trial_end,
    cancel_at_period_end,
    cancel_at,
    items,
    id,
  } = subscriptionUpdates;

  // Find the user based on the customer ID
  let user = await User.findOne({
    stripeCustomerId: customer,
  }).select("+stripeCustomerId");

  if (!user) return; // Return if user not found

  // Handle plan upgrade or downgrade
  user = await downgradePlanHandler(user, items.data[0].price.id);

  // Handle trial period
  if (status === "trialing") {
    user.trialEnd = trial_end ? new Date(trial_end * 1000) : null;

    if (user.subscriptionCancelAtPeriodEnd) {
      user.subscriptionCancelAtPeriodEnd = false;
      user.subscriptionCancelAt = null;
    }
  } else {
    user.trialEnd = null;
  }

  // Handle subscription cancellation
  if (cancel_at_period_end || cancel_at) {
    user.subscriptionCancelAtPeriodEnd = cancel_at_period_end;
    user.subscriptionCancelAt = cancel_at ? new Date(cancel_at * 1000) : null;
  } else {
    user.subscriptionCancelAtPeriodEnd = false;
    user.subscriptionCancelAt = null;
  }
  if (["incomplete", "incomplete_expired"].includes(status)) {
    user.subscriptionStatus = status;
    user.plan = "base";
  } else {
    user.plan = mapPriceIdToPlan(items.data[0].price.id);
    user.subscriptionStatus = status;
  }

  user.stripeSubscriptionId = id;
  user.hasUsedFreeTrial = true;
  await user.save();
}

// Handle subscription deletion
async function handleSubscriptionDeletion(subscription) {
  // Find the user based on the subscription ID
  const user = await User.findOne({
    stripeCustomerId: subscription.customer,
  }).select("+stripeCustomerId");

  if (!user) {
    return;
  }

  // Archive all the user ingredients
  await UserIngredient.updateOne(
    { user: user._id },
    { $set: { "ingredients.$[].archived": true } },
  );

  // Update the user subscription status
  user.archivedData = null;
  user.plan = "base";
  user.subscriptionStatus = "canceled";
  user.trialEnd = null;
  user.subscriptionCancelAtPeriodEnd = false;
  user.subscriptionCancelAt = null;
  await user.save();
}

// Handle charge failed
async function handleChargeFailed(charge) {
  const { customer, status } = charge;
  const user = await User.findOne({
    stripeCustomerId: customer,
  }).select("+stripeCustomerId");

  if (!user) return;

  // Update the user subscription status
  if (
    (status === "failed" && user.subscriptionStatus === "active") ||
    user.subscriptionStatus === "trialing"
  ) {
    user.subscriptionStatus = "past_due";
    await user.save();
  }
}

module.exports = router;
