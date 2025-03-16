const { default: axios } = require("axios");

// Helper function to map the price ID to a plan
const mapPriceIdToPlan = (priceId) => {
  switch (priceId) {
    case process.env.STRIPE_PRICE_ID_BASIC:
      return "basic";
    case process.env.STRIPE_PRICE_ID_PRO:
      return "pro";
    case process.env.STRIPE_PRICE_ID_PREMIUM:
      return "premium";
    default:
      return "base";
  }
};

// Helper function to check if a date is valid
const inValidDate = (date) => {
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
};

// Verify recaptcha token
const verifyRecaptcha = async (token) => {
  const secretKey = process.env.GOOGLE_RECATCHA_SECRET_KEY;
  const url = `https://www.google.com/recaptcha/api/siteverify`;

  const response = await axios.post(url, null, {
    params: {
      secret: secretKey,
      response: token,
    },
  });

  return response.data.success;
};

// Transfor to upercase first letter
const transformToUppercaseFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};

module.exports = {
  mapPriceIdToPlan,
  inValidDate,
  verifyRecaptcha,
  transformToUppercaseFirstLetter,
};
