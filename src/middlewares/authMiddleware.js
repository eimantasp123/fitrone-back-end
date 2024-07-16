const jwt = require("jsonwebtoken");
const Session = require("../models/SessionSchema");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  const token = req.cookies["accessToken"];
  const refreshToken = req.cookies["refreshToken"];
  if (!token && !refreshToken) return res.status(200).json({ message: "No tokens found", code: "NO_TOKENS" });
  if (!token && refreshToken) return res.status(200).json({ message: "Refresh token found", code: "REFRESH_TOKENS" });
  if (!token) return;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await Session.findOne({ userId: decoded.id, token });
    if (!session) return res.sendStatus(401);

    req.user = await User.findById(decoded.id);
    session.lastAccessed = new Date();
    await session.save();

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
