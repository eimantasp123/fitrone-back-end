const express = require("express");
const authenticateToken = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/dashboard", authenticateToken, (req, res) => {
  res.send("Welcome to the dashboard!");
});

module.exports = router;
