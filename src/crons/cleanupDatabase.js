const Customer = require("../models/Customer");
const User = require("../models/User");

module.exports = async () => {
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
    const users = await User.find({
      emailVerificationExpires: { $lt: new Date() },
    });

    for (const user of users) {
      user.emailVerificationCode = undefined; // Remove the encrypted field
      user.emailVerificationExpires = undefined;
      await user.save(); // This ensures encryption is applied
    }

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
