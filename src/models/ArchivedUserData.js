const mongoose = require("mongoose");

const archivedUserDataSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  lang: {
    type: String,
    default: "en",
  },
  ingredients: [
    {
      title: {
        lt: {
          type: String,
          required: true,
          lowercase: true,
        },
        en: {
          type: String,
          required: true,
          lowercase: true,
        },
      },
      unit: {
        type: String,
        required: true,
      },
      amount: {
        type: Number,
        required: true,
      },
      calories: {
        type: Number,
        required: true,
      },
      protein: {
        type: Number,
        required: true,
      },
      fat: {
        type: Number,
        required: true,
      },
      carbs: {
        type: Number,
        required: true,
      },
      createdAt: {
        type: Date,
        required: true,
      },
      updatedAt: {
        type: Date,
        required: true,
      },
    },
  ],
});

const ArchivedUserData = mongoose.model(
  "ArchivedUserData",
  archivedUserDataSchema,
);

module.exports = ArchivedUserData;
