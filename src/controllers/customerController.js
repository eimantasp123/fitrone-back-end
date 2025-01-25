const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const Customer = require("../models/Customer");
const { sendMessageToQueue } = require("../utils/awsHelper");
const { updateCustomerSchema } = require("../utils/validations");
const {
  verifyRecaptcha,
  transformToUppercaseFirstLetter,
} = require("../utils/generalHelpers");
const { sendMessageToClients } = require("../utils/websocket");

/**
 * Function to craeat a new customer manually
 */
exports.createCustomerManually = catchAsync(async (req, res, next) => {
  // Check if email and first name are provided
  if (!req.body.email || !req.body.firstName) {
    return next(new AppError("Email and first name are required", 400));
  }

  // Check if customer with this email already exists
  let customer = await Customer.findOne({
    supplier: req.user._id,
    email: req.body.email,
  });

  if (customer) {
    return next(new AppError("Customer with this email already exists", 400));
  }

  // Validate the request body
  let validateDate;
  try {
    validateDate = await updateCustomerSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    return next(new AppError(error.errors.join(", "), 400));
  }

  // Create a new customer
  await Customer.create({
    supplier: req.user._id,
    status: "active",
    ...validateDate,
  });

  res.status(201).json({
    status: "success",
    message: "Customer created successfully",
  });
});

/**
 * Function to update customer details
 */
exports.updateCustomer = catchAsync(async (req, res, next) => {
  const { id: customerId } = req.params;
  const updates = req.body;

  // Validate the request body
  let validateDate;
  try {
    validateDate = await updateCustomerSchema.validate(updates, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    return next(new AppError(error.errors.join(", "), 400));
  }

  // Find customer and update provided details
  const customer = await Customer.findByIdAndUpdate(
    customerId,
    { $set: validateDate },
    {
      runValidators: true,
    },
  );

  // If customer does not exist, return an error
  if (!customer) {
    return next(new AppError("Customer not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "Customer details updated successfully",
  });
});

/**
 * Function to send form to customer
 */
exports.sendFormToCustomer = catchAsync(async (req, res, next) => {
  const { email, firstName } = req.body;

  // Check if email and first name are provided
  if (!email || !firstName) {
    return next(new AppError("Email and first name are required", 400));
  }

  // Check if customer with this email already exists
  let customer = await Customer.findOne({
    supplier: req.user._id,
    email,
  });

  // If customer already exists, return an error
  if (customer) {
    return next(new AppError("Customer with this email already exists", 400));
  }

  // Create a new customer
  customer = await Customer.create({
    supplier: req.user._id,
    email,
    firstName,
    status: "pending",
  });

  const token = customer.createConfirmFormToken();
  await customer.save();

  const messageBody = {
    email: "no-reply@fitrone.com",
    template: "template-email-requests-to-customers-regarding-form-completion",
    data: {
      emailSubject: req.t("customers:customerConfirmationEmail.subject"),
      emailTitle: req.t("customers:customerConfirmationEmail.emailTitle", {
        customerName: transformToUppercaseFirstLetter(firstName),
      }),
      paragraph1: req.t("customers:customerConfirmationEmail.paragraph1", {
        supplierName: transformToUppercaseFirstLetter(req.user.firstName),
      }),
      paragraph2: req.t("customers:customerConfirmationEmail.paragraph2"),
      buttonText: req.t("customers:customerConfirmationEmail.buttonText"),
      formUrlWithToken: `http://localhost:3000/customer-form/${token}`,
    },
  };

  await sendMessageToQueue(
    messageBody,
    process.env.EMAIL_SQS_SEND_FORM_TO_CUSTOMER_URL,
  );

  res.status(200).json({
    status: "success",
    message: "Form sent to customer successfully",
  });
});

/**
 * Function to resend form to customer
 */
exports.resendFormToCustomer = catchAsync(async (req, res, next) => {
  const { customerId } = req.body;

  // Check if customer ID is provided
  if (!customerId) {
    return next(new AppError("Customer ID is required", 400));
  }

  // Find the customer by ID
  const customer = await Customer.findById(customerId);

  // If customer does not exist, return an error
  if (!customer) {
    return next(new AppError("Customer not found", 404));
  }

  // If customer status is not pending, return an error
  if (customer.status !== "pending") {
    return next(new AppError("Customer form already completed", 400));
  }

  const token = customer.createConfirmFormToken();
  await customer.save();

  const messageBody = {
    email: "no-reply@fitrone.com",
    template: "template-email-requests-to-customers-regarding-form-completion",
    data: {
      emailSubject: req.t("customers:customerConfirmationEmail.subject"),
      emailTitle: req.t("customers:customerConfirmationEmail.emailTitle", {
        customerName: transformToUppercaseFirstLetter(customer.firstName),
      }),
      paragraph1: req.t("customers:customerConfirmationEmail.paragraph1", {
        supplierName: transformToUppercaseFirstLetter(req.user.firstName),
      }),
      paragraph2: req.t("customers:customerConfirmationEmail.paragraph2"),
      buttonText: req.t("customers:customerConfirmationEmail.buttonText"),
      formUrlWithToken: `http://localhost:3000/customer-form/${token}`,
    },
  };

  await sendMessageToQueue(
    messageBody,
    process.env.EMAIL_SQS_SEND_FORM_TO_CUSTOMER_URL,
  );

  res.status(200).json({
    status: "success",
    message: "Form sent to customer successfully",
  });
});

/**
 * Function to confirm form completion
 */
exports.confirmCustomerForm = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { recaptchaToken } = req.query;

  // Verify recaptcha token
  const isHuman = await verifyRecaptcha(recaptchaToken);
  if (!isHuman) {
    return next(new AppError("Verification failed. Please try again.", 400));
  }

  // Check if token is provided
  if (!token) {
    return next(new AppError("Token is required", 400));
  }

  // Find the customer by token
  let customer = await Customer.findByToken(token);

  // If customer does not exist, return an error
  if (!customer) {
    return next(new AppError("Invalid or expired token", 400));
  }

  let validateDate;
  try {
    validateDate = await updateCustomerSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    return next(new AppError(error.errors.join(", "), 400));
  }

  // Update the customer status
  customer.status = "active";
  customer.confirmFormToken = undefined;
  customer.confirmFormTokenExpires = undefined;

  Object.assign(customer, validateDate);

  await customer.save();

  // Send a message to the client
  sendMessageToClients(customer.supplier, "customer_form_confirmed");

  res.status(200).json({
    status: "success",
    message: "Form confirmed successfully",
  });
});

/**
 * Function to delete a customer
 */
exports.deleteCustomer = catchAsync(async (req, res, next) => {
  const { id: customerId } = req.params;

  // Check if customer ID is provided
  if (!customerId) {
    return next(new AppError("Customer ID is required", 400));
  }

  // Find the customer by ID
  const customer = await Customer.findById(customerId);

  // If customer does not exist, return an error
  if (!customer) {
    return next(new AppError("Customer not found", 404));
  }

  await customer.deleteOne();

  res.status(200).json({
    status: "success",
    message: "Customer deleted successfully",
  });
});

/**
 * Get all customers
 */
exports.getAllCustomers = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, preference, status, gender, query } = req.query;

  // Pagination options
  const skip = (page - 1) * limit;

  // Query options
  const dbQuery = {
    supplier: req.user._id,
  };

  // Add preferences, restrictions, and search query to the dbQuery
  if (preference && preference.length > 0) {
    console.log("set prefrence to dbQuery", preference);
    dbQuery.preferences = preference;
  }

  if (status && status.length > 0) {
    dbQuery.status = status;
  }

  if (gender && gender.length > 0) {
    dbQuery.gender = gender;
  }

  if (query && query.length > 0) {
    dbQuery.$or = [
      { firstName: { $regex: query, $options: "i" } },
      { lastName: { $regex: query, $options: "i" } },
    ];
  }

  // Get the total number of documents and the documents for the current page
  const [total, totalForFetch, customers] = await Promise.all([
    Customer.countDocuments({ supplier: req.user._id }),
    Customer.countDocuments(dbQuery),
    Customer.find(dbQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .select(" -__v -createdAt -updatedAt"),
  ]);

  // Send the response
  res.status(200).json({
    status: "success",
    results: customers.length,
    total,
    currentPage: parseInt(page),
    totalPages: Math.ceil(totalForFetch / limit),
    data: customers,
  });
});
