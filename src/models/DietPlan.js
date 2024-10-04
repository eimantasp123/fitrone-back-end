const mongoose = require("mongoose");

const dietPlanSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  planBalance: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DietPlanBalance",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const DietPlan = mongoose.model("DietPlan", dietPlanSchema);
module.exports = DietPlan;
