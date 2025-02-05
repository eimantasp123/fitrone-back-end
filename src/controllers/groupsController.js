const Group = require("../models/Group");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Customer = require("../models/Customer");
const { transformToUppercaseFirstLetter } = require("../utils/generalHelpers");

/**
 * Middleware to check if the group exists
 */
exports.checkIfGroupExists = catchAsync(async (req, res, next) => {
  const { groupId } = req.params;
  // Find the group by ID
  const group = await Group.findOne({ _id: groupId, createdBy: req.user._id });

  // If group does not exist, return an error
  if (!group) {
    return next(
      new AppError(req.t("groups:validationErrors.groupNotFound"), 404),
    );
  }

  next();
});

/**
 * Middleware to check if the group exists with same title
 */
exports.checkIfGroupExistsWithTitle = catchAsync(async (req, res, next) => {
  const { title } = req.body;
  const { groupId } = req.params;

  // Find group with same title and createdBy
  const query = {
    title: title,
    createdBy: req.user._id,
  };

  // If groupId is present, exclude the group with that ID
  if (groupId) {
    query._id = { $ne: groupId };
  }

  // Find the group with the query
  const groupWithSameTitle = await Group.findOne(query);

  // If group with same title and createdBy exists, return an error
  if (groupWithSameTitle) {
    return next(
      new AppError(req.t("groups:validationErrors.groupAlreadyExists"), 400),
    );
  }

  next();
});

/**
 * Function to create a new group
 */
exports.createGroup = catchAsync(async (req, res, next) => {
  const { title } = req.body;

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
  const groups = await Group.find({ createdBy: req.user._id })
    .select("title createdAt")
    .sort("-createdAt")
    .lean();

  res.status(200).json({
    status: "success",
    results: groups.length,
    data: groups,
  });
});

/**
 * Function to get current group by id with members
 */
exports.getGroup = catchAsync(async (req, res, next) => {
  const { groupId } = req.params;

  // Find the group with the ID
  const group = await Group.findOne({
    _id: groupId,
    createdBy: req.user._id,
  })
    .select("-__v -createdBy")
    .populate({
      path: "members",
      select: "-__v -groupId -supplier -createdAt -updatedAt",
    });

  // Send response
  res.status(200).json({
    status: "success",
    data: group,
  });
});

/**
 * Function to delete group
 */
exports.deleteGroup = catchAsync(async (req, res, next) => {
  const { groupId } = req.params;

  // Remove groupId from all customers
  await Customer.updateMany({ groupId: groupId }, { $set: { groupId: null } });

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
      const name = `${transformToUppercaseFirstLetter(customer.firstName)} ${transformToUppercaseFirstLetter(customer.lastName)}`;
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
  await Group.updateOne(
    {
      _id: groupId,
      createdBy: req.user._id,
    },
    {
      $addToSet: { members: { $each: customers } },
    },
  );

  // Add groupId to all customers
  await Customer.updateMany(
    { _id: { $in: customers } },
    { $set: { groupId: groupId } },
  );

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("groups:membersAttachedSuccessfully", {
      count: customers.length,
    }),
  });
});

/**
 * Function to remove customer from group
 */
exports.removeCustomerFromGroup = catchAsync(async (req, res, next) => {
  const { groupId, customerId } = req.params;

  // Remove groupId from the customer
  await Customer.updateOne({ _id: customerId }, { groupId: null });

  // Remove customer from the group
  await Group.updateOne(
    { _id: groupId, createdBy: req.user._id },
    { $pull: { members: customerId } },
  );

  // Send response
  res.status(200).json({
    status: "success",
    message: req.t("groups:customerRemovedSuccessfully"),
  });
});
