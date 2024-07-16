const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  token: String,
  createdAt: { type: Date, default: Date.now },
  lastAccessed: { type: Date, default: Date.now },
  userAgent: String,
  ipAddress: String,
});

const Session = mongoose.model("Session", sessionSchema);

module.exports = Session;
