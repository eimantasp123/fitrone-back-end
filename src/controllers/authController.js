const User = require("../models/User");
const Session = require("../models/SessionSchema");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const { generateTokens } = require("../utils/tokenUtils");
const { sendPasswordResetEmail, sendVerificationEmail } = require("../utils/emailService");
const { sendVerificationCode, verifyCode } = require("../utils/twilioClient");

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

const register = async (req, res, next) => {
  const { email, password, lastName, firstName } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(16).toString("hex");

    user = new User({
      email,
      password: hashedPassword,
      lastName,
      firstName,
      verificationToken,
    });

    await user.save();
    await sendVerificationEmail(user.email, user.verificationToken);

    res.status(200).json({
      message: "User registered successfully. Please check your email for verification.",
    });
  } catch (error) {
    next(error);
  }
};

const facebookAuth = async (req, res, next) => {
  const { accessToken: fbAccessToken, userID } = req.body;
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v11.0/${userID}?fields=id,name,email,picture.width(200).height(200)&access_token=${fbAccessToken}`
    );
    const { id, email, picture, name } = response.data;
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        facebookId: id,
        email,
        isVerified: true,
        firstName: name.split(" ")[0],
        lastName: name.split(" ")[1],
        profileImage: picture.data.url,
        role: "trainer",
      });
      await user.save();
    } else if (user.facebookId !== id) {
      return res.status(400).json({
        message: "This email is already registered with a different login method.",
      });
    }

    const { token: accessToken, refreshToken } = generateTokens(user._id);
    setAuthCookies(res, accessToken, refreshToken);

    const session = new Session({
      userId: user._id,
      token: accessToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    await session.save();

    return res.status(200).json({
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImage: user.profileImage,
    });
  } catch (error) {
    next(error);
  }
};

const googleAuth = async (req, res, next) => {
  const { token } = req.body;

  try {
    if (!token) {
      throw new Error("Token is required");
    }
    const response = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const { sub, email, picture, given_name, family_name, email_verified } = response.data;

    if (!email_verified) {
      return res.status(400).json({ message: "Email not verified" });
    }
    const highResPicture = picture ? picture.replace("s96-c", "s400-c") : "";

    let user = await User.findOne({ email: email });
    if (!user) {
      user = new User({
        googleId: sub,
        email,
        firstName: given_name,
        lastName: family_name,
        isVerified: true,
        profileImage: highResPicture,
        role: "trainer",
      });
      await user.save();
    } else if (user.googleId !== sub) {
      return res.status(400).json({
        message: "This email is already registered with a different login method.",
      });
    }

    const { token: accessToken, refreshToken } = generateTokens(user._id);
    setAuthCookies(res, accessToken, refreshToken);

    const session = new Session({
      userId: user._id,
      token: accessToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    await session.save();

    return res.status(200).json({
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImage: user.profileImage,
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found");
      return res.status(400).json({ message: "User not found." });
    }
    if (!user.isVerified) {
      return res.status(400).json({ message: "Email not verified." });
    }
    if (user.googleId) {
      return res.status(400).json({ message: "This email is registered with Google login." });
    }
    if (user.facebookId) {
      return res.status(400).json({ message: "This email is registered with Facebook login." });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("Incorrect password");
      return res.status(400).json({ message: "Incorrect password." });
    }

    if (user.is2FAEnabled) {
      const code = await sendVerificationCode(user.phone);
      console.log("2FA enabled" + code);
      user.twoFactorCode = code;
      user.twoFactorExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
      await user.save();

      return res.status(200).json({
        is2FA: user.is2FAEnabled,
        userId: user._id,
      });
    }

    const { token: accessToken, refreshToken } = generateTokens(user._id);
    setAuthCookies(res, accessToken, refreshToken);

    const session = new Session({
      userId: user._id,
      token: accessToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    await session.save();

    return res.status(200).json({
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImage: user.profileImage,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const verifyLogin = async (req, res, next) => {
  const { userId, code } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: "Invalid user" });
    if (user.twoFactorCode !== code || user.twoFactorExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    user.twoFactorCode = null;
    user.twoFactorExpires = null;
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

    return res.status(200).json({
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImage: user.profileImage,
    });
  } catch (error) {
    next(error);
  }
};

const resendCode = async (req, res, next) => {
  const { userId } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: "Invalid user" });

    const code = await sendVerificationCode(user.phone);
    console.log("2FA enabled" + code);
    user.twoFactorCode = code;
    user.twoFactorExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    return res.status(200).json({ message: "Code sent successfully" });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.googleId) {
      return res.status(400).json({ message: "This email is registered with Google login." });
    }

    if (user.facebookId) {
      return res.status(400).json({ message: "This email is registered with Facebook login." });
    }

    const token = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const emailResponse = await sendPasswordResetEmail(user.email, token);
    if (emailResponse.success) {
      res.status(200).json({ message: `Please check your inbox!`, email: user.email });
    } else {
      res.status(500).json({ message: emailResponse.error });
    }
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  const { token, password } = req.body;
  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    res.status(200).json({ message: "Password reset successfully!" });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token not found" });
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.sendStatus(403);
    }
    await Session.deleteMany({ userId: user._id });
    const { token: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    setAuthCookies(res, newAccessToken, newRefreshToken);

    const session = new Session({
      userId: user._id,
      token: newAccessToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    await session.save();

    return res.status(200).json({
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImage: user.profileImage,
    });
  } catch (error) {
    return res.sendStatus(401); // Unauthorized
  }
};

const logout = async (req, res, next) => {
  const { accessToken } = req.cookies;
  if (!accessToken) {
    return res.status(400).json({ message: "No access token found" });
  }
  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    await Session.deleteMany({ userId: decoded.id });
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  facebookAuth,
  googleAuth,
  login,
  logout,
  verifyLogin,
  forgotPassword,
  resetPassword,
  refreshToken,
  resendCode,
};
