const jwt = require("jsonwebtoken");

const generateTokens = (userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "14d",
    },
  );
  return { token, refreshToken };
};

module.exports = generateTokens;
