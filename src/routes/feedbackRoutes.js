const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const feedbackController = require("../controllers/feedbackController");

const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);
//
router.post("/", feedbackController.feedback);

module.exports = router;
