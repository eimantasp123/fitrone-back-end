const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { generateTokens } = require("../utils/tokenUtils");

router.get("/verify/:token", async (req, res) => {
  const { token } = req.params;
  console.log("Token:", token);
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.isVerified = true;
    user.verificationToken = null;

    const { token: accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    res.cookie("token", accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
    });
    await user.save();
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error("Error verifying user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
