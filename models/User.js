const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: "30d" },
});

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, index: true },
  password: { type: String, default: null },
  phone: { type: String, default: null },
  firstName: { type: String, default: null },
  lastName: { type: String, default: null },
  profileImage: {
    type: String,
    default:
      "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y",
  },
  role: {
    type: String,
    enum: ["client", "trainer", "admin"],
    default: "trainer",
  },
  googleId: { type: String, default: null },
  facebookId: { type: String, default: null },
  isVerified: { type: Boolean, default: false },
  is2FAEnabled: { type: Boolean, default: false },
  verificationToken: { type: String, default: null },
  twoFactorCode: { type: String, default: null },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  refreshTokens: { type: [refreshTokenSchema], default: [] },
  twoFactorExpires: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
