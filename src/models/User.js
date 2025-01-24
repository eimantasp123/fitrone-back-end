const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: [true, "Email is required"],
    lowercase: true,
    validate: [validator.isEmail, "Please provide a valid email"],
  },
  password: {
    type: String,
    select: false,
    validate: {
      validator: function (el) {
        return el.length > 8 && /(?=.*[0-9])(?=.*[!@#$%^&*])/.test(el);
      },
      message:
        "Password must be at least 8 characters long, contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    },
  },
  passwordConfirm: {
    type: String,
    validate: {
      validator: function (el) {
        return el === this.password;
      },
      message: "Passwords do not match",
    },
  },
  phone: { type: String, trim: true, select: true, default: "" },
  firstName: {
    type: String,
    trim: true,
    lowercase: true,
    minlength: [2, "First name must be at least 2 characters long"],
    maxlength: [50, "First name must be less than 50 characters long"],
  },
  lastName: {
    type: String,
    trim: true,
    required: false,
    lowercase: true,
    maxlength: [50, "Last name must be less than 50 characters long"],
  },
  profileImage: {
    type: String,
    default:
      "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y",
  },
  role: {
    type: String,
    enum: ["supplier", "admin"],
    default: "supplier",
  },
  plan: {
    type: String,
    enum: ["base", "basic", "pro", "premium"],
    default: "base",
  },
  systemLanguage: {
    type: String,
    enum: ["en", "lt"],
    default: "en",
  },
  timezone: {
    type: String,
    default: null,
  },
  stripeCustomerId: { type: String, select: false },
  stripeSubscriptionId: { type: String, select: false },
  hasUsedFreeTrial: { type: Boolean, default: false },
  subscriptionStatus: {
    type: String,
    enum: [
      "active",
      "base",
      "trialing",
      "past_due",
      "canceled",
      "incomplete",
      "incomplete_expired",
    ],
    default: "base",
  },
  trialEnd: { type: Date },
  subscriptionCancelAtPeriodEnd: { type: Boolean, default: false },
  subscriptionCancelAt: { type: Date },

  googleId: { type: String, unique: true, sparse: true },
  facebookId: { type: String, unique: true, sparse: true },
  isVerified: { type: Boolean, default: false, select: false },
  registrationCompleted: { type: Boolean, default: false, select: false },
  is2FAEnabled: { type: Boolean, default: false },
  emailVerificationCode: { type: String },
  emailVerificationExpires: { type: Date },
  twoFactorCode: { type: String },
  twoFactorExpires: { type: Date },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
  passwordChangedAt: { type: Date },

  archivedData: {
    messageRead: { type: Boolean, default: false },
    ingredients: { type: Number, default: null },
    meals: { type: Number, default: null },
    mealWeekTypes: { type: Number, default: null },
    clients: { type: Number, default: null },
  },
});

// Document middleware to hash the password before saving
userSchema.pre("save", async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

// Document middleware to update passwordChangedAt property for the user
userSchema.pre("save", function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified("password") || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Instance method to compare the entered password with the hashed password
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if the user changed the password after the token was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Instance method to verify the email verification token
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

// Static method to find a user by email and check if the email is verified
userSchema.statics.findByResetToken = async function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await this.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });
  return user;
};

// Method to verify the reset token and reset the password
userSchema.methods.resetPassword = async function (
  newPassword,
  newPasswordConfirm,
) {
  this.password = newPassword;
  this.passwordConfirm = newPasswordConfirm;
  this.resetPasswordToken = undefined;
  this.resetPasswordExpires = undefined;
  await this.save();
};

const User = mongoose.model("User", userSchema);
module.exports = User;
