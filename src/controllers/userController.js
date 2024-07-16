const User = require("../models/User");

const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("email role firstName lastName profileImage -_id");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    return res.status(401).json({ message: "Error retrieving user information" });
  }
};

module.exports = {
  getCurrentUser,
};
