const Customer = require("../models/Customer");
const User = require("../models/User");
const cron = require("node-cron");

// Cron Job - Runs every midnight to clean up expired data
cron.schedule("0 0 * * *", () => cleanupDatabase());

const cleanupDatabase = async () => {
  try {
    // Remove two-factor codes and expires for users with expired codes
    await User.updateMany(
      { twoFactorExpires: { $lt: new Date() } },
      { $unset: { twoFactorCode: null, twoFactorExpires: null } },
    );
    // Remove reset password tokens and expires for users with expired tokens
    await User.updateMany(
      { resetPasswordExpires: { $lt: new Date() } },
      {
        $unset: {
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      },
    );
    // Remove email verification codes and expires for users with expired codes
    await User.updateMany(
      { emailVerificationExpires: { $lt: new Date() } },
      {
        $unset: {
          emailVerificationCode: null,
          emailVerificationExpires: null,
        },
      },
    );
    // Remove token from customers
    await Customer.updateMany(
      { confirmFormTokenExpires: { $lt: new Date() } },
      {
        $unset: {
          confirmFormToken: null,
          tokenExpconfirmFormTokenExpiresires: null,
        },
      },
    );
  } catch (error) {
    console.error("Error during cleanup for user token cleanup:", error);
  }
};
