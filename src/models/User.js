const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const encrypt = require("mongoose-encryption");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: [true, "Email is required"],
    lowercase: true,
    sparse: true,
    validate: [validator.isEmail, "Please provide a valid email"],
  },
  emailHash: {
    type: String,
    unique: true,
    select: false,
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
  businessName: {
    type: String,
    trim: true,
    maxlength: [50, "Business name must be less than 50 characters long"],
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
  testMode: {
    type: Boolean,
    default: false,
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
  stripeCustomerId: { type: String, default: null, select: false },
  stripeSubscriptionId: { type: String, default: null, select: false },
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
    weeklyMenus: { type: Number, default: null },
  },
});

// **Pre-save hook to hash email before saving**
userSchema.pre("save", function (next) {
  if (this.isModified("email")) {
    this.emailHash = crypto
      .createHash("sha256")
      .update(this.email)
      .digest("hex");
  }
  next();
});

// Apply encryption plugin
userSchema.plugin(encrypt, {
  encryptionKey: process.env.MONGODB_USER_ENCRYPTION_KEY,
  signingKey: process.env.MONGODB_USER_SIGNING_KEY,
  encryptedFields: [
    "email",
    "phone",
    "lastName",
    "googleId",
    "facebookId",
    "emailVerificationCode",
    "twoFactorCode",
  ],
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
  next();
});

// Set passwordChangedAt timestamp
userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Use email hash for searching
userSchema.statics.findByEmail = async function (email, fields = "") {
  const emailHash = crypto.createHash("sha256").update(email).digest("hex");
  return await this.findOne({ emailHash }).select(fields);
};

// Password comparison
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Check if password changed after token issue
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

// Password reset token creation
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

// Find user by reset token
userSchema.statics.findByResetToken = async function (token) {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await this.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });
  return user;
};

// Reset password
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
