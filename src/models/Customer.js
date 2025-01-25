const mongoose = require("mongoose");
const crypto = require("crypto");

const customerSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastName: { type: String },
    email: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "active",
    },
    phone: { type: String },
    age: { type: Number },
    gender: { type: String, enum: ["male", "female", "transgender", "other"] },
    height: { type: Number },
    weight: { type: Number },
    fitnessGoal: {
      type: String,
      enum: [
        "weightLoss",
        "weightGain",
        "weightMaintenance",
        "improveHealth",
        "weightLossAndMuscleGain",
        "other",
      ],
    },
    weightGoal: { type: Number },
    physicalActivityLevel: {
      type: String,
      enum: ["sedentary", "lightlyActive", "moderatelyActive", "veryActive"],
    },
    confirmFormToken: { type: String },
    confirmFormTokenExpires: { type: Date },
    preferences: {
      type: [String],
      default: [],
      enum: {
        values: [
          "vegetarian",
          "vegan",
          "pescatarian",
          "flexitarian",
          "paleo",
          "keto",
          "lowCarb",
          "mediterranean",
          "highProtein",
          "plantBased",
          "balanced",
          "spicy",
          "sweet",
        ],
        message: "invalidPreference",
      },
    },
    restrictions: {
      type: [String],
      default: [],
      enum: {
        values: [
          "glutenFree",
          "dairyFree",
          "nutFree",
          "eggFree",
          "soyFree",
          "shellfishFree",
          "halal",
          "kosher",
          "lowSodium",
          "sugarFree",
        ],
        message: "invalidRestriction",
      },
    },
    foodAllergies: { type: String },
    address: { type: String },
    latitude: { type: String },
    longitude: { type: String },
  },
  {
    timestamps: true,
  },
);

// Instance method to create token for confirming the form
customerSchema.methods.createConfirmFormToken = function () {
  const confirmFormToken = crypto.randomBytes(32).toString("hex");
  this.confirmFormToken = crypto
    .createHash("sha256")
    .update(confirmFormToken)
    .digest("hex");
  this.confirmFormTokenExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return confirmFormToken;
};

// Static method to find a user by crypto token
customerSchema.statics.findByToken = async function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const customer = await this.findOne({
    confirmFormToken: hashedToken,
    confirmFormTokenExpires: { $gt: Date.now() },
  });
  return customer;
};

const Customer = mongoose.model("Customer", customerSchema);
module.exports = Customer;
