const express = require("express");
const passport = require("passport");
const crypto = require("crypto");
const axios = require("axios");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middlewares/authMiddleware");
const { generateTokens } = require("../utils/tokenUtils");
const twilio = require("twilio");
const bcrypt = require("bcryptjs");
const {
  sendPasswordResetEmail,
  sendVerificationEmail,
} = require("../utils/emailService");

const router = express.Router();
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

router.post("/register", async (req, res) => {
  const { email, password, lastName, firstName } = req.body;
  try {
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(16).toString("hex");

    console.log("Verification token:", verificationToken + " " + email);

    if (!user) {
      user = new User({
        email,
        password: hashedPassword,
        lastName,
        firstName,
        verificationToken,
      });

      await user.save();
      console.log("User saved:", user);
      await sendVerificationEmail(user.email, user.verificationToken);

      res.status(200).json({
        message:
          "User registered successfully. Please check your email for verification.",
      });
    }
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/facebook", async (req, res) => {
  const { accessToken: fbAccessToken, userID } = req.body;
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v11.0/${userID}?fields=id,name,email,picture&access_token=${fbAccessToken}`
    );
    const { id, email, picture, name } = response.data;
    let user = await User.findOne({ email: email });

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
        message:
          "This email is already registered with a different login method.",
      });
    }

    const { token: accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    res.cookie("token", accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      domain: "localhost",
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      domain: "localhost",
    });

    return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error("Error verifying Facebook token:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/google", async (req, res) => {
  const { token } = req.body;

  try {
    if (!token) {
      throw new Error("Token is required");
    }
    const response = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const { sub, email, picture, given_name, family_name, email_verified } =
      response.data;

    if (!email_verified) {
      return res.status(400).json({ message: "Email not verified" });
    }

    let user = await User.findOne({ email: email });
    if (!user) {
      user = new User({
        googleId: sub,
        email,
        firstName: given_name,
        lastName: family_name,
        isVerified: true,
        profileImage: picture,
        role: "trainer",
      });
      await user.save();
    } else if (user.googleId !== sub) {
      return res.status(400).json({
        message:
          "This email is already registered with a different login method.",
      });
    }

    const { token: accessToken, refreshToken } = generateTokens(user._id);
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    res.cookie("token", accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      domain: "localhost",
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      domain: "localhost",
    });

    return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error("Error verifying Google token:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// router.post("/login", (req, res, next) => {
//   passport.authenticate("local", async (err, user, info) => {
//     if (err) {
//       return res.status(500).json({ message: "Internal Server Error" });
//     }
//     if (!user) {
//       return res.status(400).json({ message: info?.message || "Login failed" });
//     }

//     if (info && info.message === "2FA required") {
//       const code = Math.floor(100000 + Math.random() * 900000).toString();
//       user.twoFactorCode = code;
//       user.twoFactorExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
//       try {
//         await user.save();
//         console.log(
//           "2FA code and expiration saved:",
//           user.twoFactorCode,
//           user.twoFactorExpires
//         );

//         twilioClient.messages.create({
//           body: `Your verification code is ${code}`,
//           from: process.env.TWILIO_PHONE_NUMBER,
//           to: user.phone,
//         });
//         return res.json({ userId: user._id });
//       } catch (saveErr) {
//         console.error("Error saving user with 2FA code:", saveErr);
//         return res.status(500).json({ message: "Error saving 2FA code" });
//       }
//     }

//     req.logIn(user, async (err) => {
//       if (err) return next(err);

//       const { token, refreshToken } = generateTokens(user._id);
//       const refreshTokenObject = { token: refreshToken };
//       user.refreshTokens.push(refreshTokenObject);
//       await user.save();

//       res.cookie("token", token, {
//         httpOnly: false,
//         secure: process.env.NODE_ENV === "production",
//         sameSite: "Lax",
//       });

//       res.cookie("refreshToken", refreshToken, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === "production",
//         sameSite: "Lax",
//       });

//       return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
//     });
//   })(req, res, next);
// });

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Incorrect email." });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: "Email not verified." });
    }

    if (user.googleId) {
      return res
        .status(400)
        .json({ message: "This email is registered with Google login." });
    }

    if (user.facebookId) {
      return res
        .status(400)
        .json({ message: "This email is registered with Facebook login." });
    }

    if (!user.password) {
      return res
        .status(400)
        .json({ message: "Password is required for this account." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect password." });
    }

    if (user.is2FAEnabled) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      user.twoFactorCode = code;
      user.twoFactorExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
      await user.save();

      twilioClient.messages.create({
        body: `Your verification code is ${code}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: user.phone,
      });

      return res.json({ userId: user._id });
    }

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

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/verify-login", async (req, res, next) => {
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

    req.logIn(user, async (err) => {
      if (err) return next(err);

      const { token, refreshToken } = generateTokens(user._id);
      const refreshTokenObject = { token: refreshToken };
      user.refreshTokens.push(refreshTokenObject);
      await user.save();

      res.cookie("token", token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
      });
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
      });

      return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.googleId) {
      return res
        .status(400)
        .json({ message: "This email is registered with Google login." });
    }

    if (user.facebookId) {
      return res
        .status(400)
        .json({ message: "This email is registered with Facebook login." });
    }

    const token = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    console.log("Token set:", token);
    console.log("Expiry set:", user.resetPasswordExpires);

    const emailResponse = await sendPasswordResetEmail(user.email, token);
    if (emailResponse.success) {
      res
        .status(200)
        .json({ message: `Please check your inbox!`, email: user.email });
    } else {
      res.status(500).json({ message: emailResponse.error });
    }
  } catch (error) {
    console.error("Error sending email:", error);
    return res.status(500).json({ message: "Error sending email" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  try {
    console.log("Reset password route called");
    console.log(req.body);

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      console.log("User not found or token expired.");
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    console.log("User found and can change password:", user);

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    res.status(200).json({ message: "Password reset successfully!" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({ message: "Error resetting password" });
  }
});

// Get current user route
router.get("/user", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "email role firstName lastName profileImage -_id"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Route to refresh token
router.post("/refresh-token", async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET,
      async (err, decoded) => {
        if (err) {
          return res.status(401).json({ message: "Unauthorized" });
        }
        const user = await User.findOne({
          "refreshTokens.token": refreshToken,
        });
        if (!user) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const newAccessToken = jwt.sign(
          { id: user._id },
          process.env.JWT_SECRET,
          {
            expiresIn: "15m",
          }
        );

        const newRefreshToken = crypto.randomBytes(40).toString("hex");
        user.refreshTokens.push({ token: newRefreshToken });
        await user.save();

        res.cookie("refreshToken", newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Lax",
        });

        return res.json({ accessToken: newAccessToken });
      }
    );
  } catch (err) {
    console.error("Error finding user by refresh token:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/logout", (req, res) => {
  req.logout();
  res.status(200).json({ message: "Logged out" });
});

module.exports = router;
