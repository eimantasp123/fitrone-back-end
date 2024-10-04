const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Create a Stripe customer if it doesn't exist
const createStripeCustomerIfNotExists = async (user) => {
  if (!user.stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
    });
    user.stripeCustomerId = customer.id;
    await user.save();
  }
  return user.stripeCustomerId;
};

module.exports = { createStripeCustomerIfNotExists };
