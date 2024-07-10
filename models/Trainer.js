const mongoose = require("mongoose");

const trainerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  clients: [{ type: mongoose.Schema.Types.ObjectId, ref: "Client" }],
  sportPlans: [{ type: mongoose.Schema.Types.ObjectId, ref: "SportPlan" }],
  dietPlans: [{ type: mongoose.Schema.Types.ObjectId, ref: "DietPlan" }],
});

module.exports = mongoose.model("Trainer", trainerSchema);
