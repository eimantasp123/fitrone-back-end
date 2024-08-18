const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const createMockUser = async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/testdb");

  const hashedPassword = await bcrypt.hash("password123", 10);

  const user = new User({
    email: "test@example.com",
    password: hashedPassword,
    phone: "+4591929387",
    role: "trainer",
    firstName: "John",
    isVerified: true,
    lastName: "Doe",
    is2FAEnabled: false,
  });

  await user.save();
  console.log("Mock user created");
  mongoose.disconnect();
};

createMockUser().catch(console.error);
