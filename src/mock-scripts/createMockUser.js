const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const createMockUser = async () => {
  await mongoose.connect("mongodb://localhost:27017/testdb", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const hashedPassword = await bcrypt.hash("password123", 10);

  const user = new User({
    email: "test@example.com",
    password: hashedPassword,
    phone: "+4591929387",
    role: "admin",
    is2FAEnabled: true,
  });

  await user.save();
  console.log("Mock user created");
  mongoose.disconnect();
};

createMockUser().catch(console.error);
