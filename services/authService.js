const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendVerificationCode, verifyCode } = require("../utils/smsService");
const User = require("../models/User");
const jwtSecret = process.env.JWT_SECRET;

const generateToken = (user) => {
  return jwt.sign({ _id: user._id, role: user.role }, jwtSecret, {
    expiresIn: "1h",
  });
};

const register = async (userData) => {
  const { email, password, phone } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ email, password: hashedPassword, phone });
  await user.save();
  // Send verification code to user's phone
  // await sendVerificationCode(phone);
  return user;
};

const login = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) throw new Error("Invalid password");

  // Send verification code to user's phone
  // await sendVerificationCode(user.phone);
  return user;
};

// const verifyLogin = async (userId, code) => {
//   const user = await User.findById(userId);
//   if (!user) throw new Error("User not found");

//   const isCodeValid = await verifyCode(user.phone, code);
//   if (!isCodeValid) throw new Error("Invalid verification code");

//   const token = generateToken(user);
//   return token;
// };

module.exports = {
  register,
  login,
  // verifyLogin,
};
