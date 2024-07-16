const User = require("../models/User");
const { generateTokens } = require("../utils/tokenUtils");
const Session = require("../models/SessionSchema");

const verifyEmail = async (req, res, next) => {
  const { token } = req.params;
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.isVerified = true;
    user.verificationToken = null;
    await user.save();

    const { token: accessToken, refreshToken } = generateTokens(user._id);
    setAuthCookies(res, accessToken, refreshToken);

    const session = new Session({
      userId: user._id,
      token: accessToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    await session.save();

    return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    next(error);
  }
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
};

module.exports = {
  verifyEmail,
};
