const express = require("express");
const verificationController = require("../controllers/verificationController");

const router = express.Router();

router.get("/verify/:token", verificationController.verifyEmail);

module.exports = router;
