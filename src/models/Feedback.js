const mongoose = require("mongoose");

// Define the schema for feedback
const feedbackSchema = new mongoose.Schema({
  rating: {
    type: Number,
    required: true,
  },
  comment: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Refers to the User model (if you want to link feedback to users)
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create the model (Mongoose will create the "feedbacks" collection automatically)
const Feedback = mongoose.model("Feedback", feedbackSchema);

module.exports = Feedback;
