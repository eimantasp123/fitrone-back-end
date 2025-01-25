const { default: axios } = require("axios");

// Helper function to map the price ID to a plan
const mapPriceIdToPlan = (priceId) => {
  switch (priceId) {
    case "price_1Q3SEZAVASYOGHJkuKEtFelC":
      return "basic";
    case "price_1Q3SF1AVASYOGHJkEpwY1xlm":
      return "pro";
    case "price_1Q3SFiAVASYOGHJkUPUY9y7u":
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
