const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const connectDB = require("../config/dbConfig");

const seedUser = async () => {
  await connectDB();

  const email = "eimiuxxx09@gmail.com";
  const password = "password123";
  const phone = "+4591929387";

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    email,
    password: hashedPassword,
    phone,
    role: "admin",
    is2FAEnabled: false,
    isVerified: true,
    googleId: "",
    facebookId: "",
    twoFactorCode: null,
    resetPasswordToken: null,
    resetPasswordExpires: null,
    twoFactorExpires: null,
    createdAt: new Date(),
  });

  await newUser.save();
  console.log("User seeded:", newUser);

  mongoose.connection.close();
};

seedUser();
