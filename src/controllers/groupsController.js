const Group = require("../models/Group");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Customer = require("../models/Customer");
const {
  ConversationPage,
} = require("twilio/lib/rest/conversations/v1/conversation");

/**
 * Function to create a new group
 */
exports.createGroup = catchAsync(async (req, res, next) => {
  const { title } = req.body;

  // Check if group with this title already exists
  const group = await Group.findOne({ title: title, createdBy: req.user._id });

  // If group with this title already exists, return an error
  if (group) {
    return next(
      new AppError(req.t("groups:validationErrors.groupAlreadyExists"), 400),
    );
  }

  // Create a new group
  await Group.create({
    title: title,
    createdBy: req.user._id,
  });

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("groups:groupCreatedSuccessfully"),
  });
});

/**
 * Function to get all groups
 */
exports.getAllGroups = catchAsync(async (req, res, next) => {
  // Find all groups created by the user
  const groups = await Group.find({ createdBy: req.user._id }).populate({
    path: "members",
    select: "firstName lastName email",
  });

  res.status(200).json({
    status: "success",
    data: groups,
  });
});

/**
 * Function to delete group
 */
exports.deleteGroup = catchAsync(async (req, res, next) => {
  const { groupId } = req.params;

  // Find the group by ID
  const group = await Group.findOne({ _id: groupId, createdBy: req.user._id });

  // If group does not exist, return an error
  if (!group) {
    return next(
      new AppError(req.t("groups:validationErrors.groupNotFound"), 404),
    );
  }

  // Delete the group
  await Group.deleteOne({ _id: groupId });

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("groups:groupDeletedSuccessfully"),
  });
});

/**
 * Function to update group title
 */
exports.updateGroup = catchAsync(async (req, res, next) => {
  const { groupId } = req.params;
  const { title } = req.body;

  // Find the group by ID
  const group = await Group.findOne({
    _id: groupId,
    createdBy: req.user._id,
  });

  // If group does not exist, return an error
  if (!group) {
    return next(
      new AppError(req.t("groups:validationErrors.groupNotFound"), 404),
    );
  }

  // Find group with same title and createdBy
  const groupWithSameTitle = await Group.findOne({
    title: title,
    createdBy: req.user._id,
  });

  // If group with same title and createdBy exists, return an error
  if (groupWithSameTitle) {
    return next(
      new AppError(req.t("groups:validationErrors.groupAlreadyExists"), 400),
    );
  }

  // Update the group title
  await Group.updateOne({ _id: groupId }, { title: title });

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("groups:groupUpdatedSuccessfully"),
  });
});

/**
 * Function to attach a member to a group
 */
exports.attachMembersToGroup = catchAsync(async (req, res, next) => {
  const { groupId } = req.params;
  const { customers } = req.body;

  // Find the group by ID
  const group = await Group.findOne({
    _id: groupId,
    createdBy: req.user._id,
  });

  // If group does not exist, return an error
  if (!group) {
    return next(
      new AppError(req.t("groups:validationErrors.groupNotFound"), 404),
    );
  }

  // Find all customers from the customers array that are not active or have a groupId
  const conflictCustomers = await Customer.find({
    supplier: req.user._id,
    _id: { $in: customers },
    $or: [
      { groupId: groupId },
      { groupId: { $ne: null } },
      { status: { $ne: "active" } },
    ],
  }).select("firstName lastName groupId status");

  // If there are any conflict customers, return a warning
  if (conflictCustomers.length > 0) {
    // Generate conflict details
    const conflictDetails = conflictCustomers.map((customer) => {
      const name = `${customer.firstName} ${customer.lastName}`;
      if (
        customer.groupId &&
        customer.groupId.toString() === groupId.toString()
      ) {
        return req.t("groups:validationErrors.details.alreadyInCurrentGroup", {
          name,
        });
      }
      if (customer.groupId) {
        return req.t("groups:validationErrors.details.alreadyInOtherGroup", {
          name,
        });
      }
      if (customer.status !== "active") {
        return req.t("groups:validationErrors.details.inactive", {
          name,
        });
      }
    });

    return res.status(200).json({
      status: "warning",
      message: req.t("groups:validationErrors.customerConflictMessage", {
        count: conflictCustomers.length,
      }),
      details: conflictDetails,
    });
  }

  // Update all customers with the groupId
  group.members.push(
    ...customers.filter(
      (customer) => !group.members.includes(customer.toString()),
    ),
  );

  // Save the group
  await group.save();

  // Add groupId to all customers
  await Customer.updateMany(
    { _id: { $in: customers } },
    { $set: { groupId: groupId } },
  );

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("groups:membersAttachedSuccessfully"),
  });
});
