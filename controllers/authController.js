const { register, login, verifyLogin } = require("../services/authService");

exports.register = async (req, res) => {
  try {
    const user = await register(req.body);
    res.status(201).send(user);
  } catch (err) {
    res.status(400).send(err.message);
  }
};

exports.login = async (req, res) => {
  try {
    const user = await login(req.body.email, req.body.password);
    res.status(200).send({ userId: user._id });
  } catch (err) {
    res.status(400).send(err.message);
  }
};

exports.verifyLogin = async (req, res) => {
  try {
    const token = await verifyLogin(req.body.userId, req.body.code);
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.status(200).send({ message: "Logged in successfully" });
  } catch (err) {
    res.status(400).send(err.message);
  }
};
