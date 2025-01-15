const { parseISO, isValid } = require("date-fns");

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

module.exports = { mapPriceIdToPlan, inValidDate };
