const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  createGroup,
  getAllGroups,
  deleteGroup,
  updateGroup,
  attachMembersToGroup,
  checkIfGroupExists,
  checkIfGroupExistsWithTitle,
  removeCustomerFromGroup,
  getGroup,
} = require("../controllers/groupsController");
const router = express.Router();

// Apply authentication middleware to all routes below this line
router.use(authMiddleware);

// Params middleware to check if the group exists
router.param("groupId", checkIfGroupExists);

// Create a new customer manually
router.post("/", checkIfGroupExistsWithTitle, createGroup);

// Get all groups created by the user
router.get("/", getAllGroups);

// Delete a group
router.delete("/:groupId", deleteGroup);

// Update a group
router.patch("/:groupId", checkIfGroupExistsWithTitle, updateGroup);

// Attach members to group
router.post("/:groupId/add-customers", attachMembersToGroup);

// Remove customer from group
router.delete("/:groupId/remove-customer/:customerId", removeCustomerFromGroup);

// Get a group by ID
router.get("/:groupId", getGroup);

module.exports = router;
