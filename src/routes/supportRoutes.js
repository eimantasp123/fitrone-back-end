const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const supportController = require("../controllers/supportController");

const router = express.Router();

/**
 * Apply authentication middleware to all routes below this line
 */
router.use(authMiddleware);

// Route to submit a support request
router.post("/", supportController.support);

module.exports = router;
