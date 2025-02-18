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
const { calculateDailyNutritionIntake } = require("../utils/healthyHelper");
const WeeklyPlan = require("../models/WeeklyPlan");

/**
 * Function to craeat a new customer manually
 */
exports.createCustomerManually = catchAsync(async (req, res, next) => {
  // Check if email and first name are provided
  if (!req.body.email || !req.body.firstName) {
    return next(
      new AppError(
        req.t("customers:validationErrors.emailAndFirstNameRequired"),
        400,
      ),
    );
  }

  // Check if customer with this email already exists
  const customer = await Customer.findOne({
    supplier: req.user._id,
    email: req.body.email,
    deletedAt: null,
  });

  if (customer) {
    return next(
      new AppError(
        req.t("customers:validationErrors.customerAlreadyExists"),
        400,
      ),
    );
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

  // Response message
  const responseData = {
    status: "success",
    message: req.t("customers:customerCreated"),
  };

  // If there is a warning, add it to the response
  if (req.warning) {
    responseData.warning = req.warning;
  }

  res.status(201).json(responseData);
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
  const customer = await Customer.findOneAndUpdate(
    {
      _id: customerId,
      supplier: req.user._id,
      deletedAt: null,
    },
    {
      $set: validateDate,
    },
    {
      runValidators: true,
    },
  );

  // If customer does not exist, return an error
  if (!customer) {
    return next(
      new AppError(req.t("customers:validationErrors.customerNotFound"), 404),
    );
  }

  customer.status = customer.status === "pending" ? "active" : customer.status;
  await customer.save();

  res.status(200).json({
    status: "success",
    message: req.t("customers:customerUpdated"),
  });
});

/**
 * Function to send form to customer
 */
exports.sendFormToCustomer = catchAsync(async (req, res, next) => {
  const { email, firstName } = req.body;

  // Check if email and first name are provided
  if (!email || !firstName) {
    return next(
      new AppError(
        req.t("customers:validationErrors.emailAndFirstNameRequired"),
        400,
      ),
    );
  }

  // Check if customer with this email already exists
  const customerAlreadyValid = await Customer.findOne({
    supplier: req.user._id,
    email,
    deletedAt: null,
  });

  // If customer already exists, return an error
  if (customerAlreadyValid) {
    return next(
      new AppError(
        req.t("customers:validationErrors.customerAlreadyExists"),
        400,
      ),
    );
  }

  // Create a new customer
  const customer = await Customer.create({
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

  // Send message to the queue
  await sendMessageToQueue(
    messageBody,
    process.env.EMAIL_SQS_SEND_FORM_TO_CUSTOMER_URL,
  );

  // Response message
  const responseData = {
    status: "success",
    message: req.t("customers:formSendSuccessfully"),
  };

  // If there is a warning, add it to the response
  if (req.warning) {
    responseData.warning = req.warning;
  }

  res.status(201).json(responseData);
});

/**
 * Function to resend form to customer
 */
exports.resendFormToCustomer = catchAsync(async (req, res, next) => {
  const { customerId } = req.body;

  // Check if customer ID is provided
  if (!customerId) {
    return next(
      new AppError(req.t("customers:validationErrors.customerIdRequired"), 400),
    );
  }

  // Find the customer by ID
  const customer = await Customer.findOne({
    _id: customerId,
    supplier: req.user._id,
    deletedAt: null,
  });

  // If customer does not exist, return an error
  if (!customer) {
    return next(
      new AppError(req.t("customers:validationErrors.customerNotFound"), 404),
    );
  }

  // If customer status is not pending, return an error
  if (customer.status !== "pending") {
    return next(
      new AppError(
        req.t("customers:validationErrors.customerFormAlreadySubmitted"),
        400,
      ),
    );
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

  // Send message to the queue
  await sendMessageToQueue(
    messageBody,
    process.env.EMAIL_SQS_SEND_FORM_TO_CUSTOMER_URL,
  );

  // Response message
  res.status(200).json({
    status: "success",
    message: req.t("customers:formSendSuccessfully"),
  });
});

/**
 * Function to confirm form completion
 */
exports.confirmCustomerForm = catchAsync(async (req, res, next) => {
  console.log("confirmCustomerForm");
  const { token } = req.params;
  const { recaptchaToken } = req.query;

  // Verify recaptcha token
  const isHuman = await verifyRecaptcha(recaptchaToken);
  if (!isHuman) {
    return next(
      new AppError(req.t("customers:validationErrors.verificationFailed"), 400),
    );
  }

  // Check if token is provided
  if (!token) {
    return next(
      new AppError(req.t("customers:validationErrors.tokenIsRequired"), 400),
    );
  }

  // Find the customer by token
  const customer = await Customer.findByToken(token);

  // If customer does not exist, return an error
  if (!customer) {
    return next(
      new AppError(req.t("customers:validationErrors.invalidToken"), 400),
    );
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
    message: req.t("customers:formConfirmedSuccessfully"),
  });
});

/**
 * Function to delete a customer
 */
exports.deleteCustomer = catchAsync(async (req, res, next) => {
  const { id: customerId } = req.params;

  // Check if customer ID is provided
  if (!customerId) {
    return next(
      new AppError(req.t("customers:validationErrors.customerIdRequired"), 400),
    );
  }

  // Find the customer by ID
  const customer = await Customer.findOne({
    _id: customerId,
    supplier: req.user._id,
    deletedAt: null,
  });

  // If customer does not exist, return an error
  if (!customer) {
    return next(
      new AppError(req.t("customers:validationErrors.customerNotFound"), 404),
    );
  }

  // Check if customer is attached to any active week plan
  const activeWeeklyPlan = await WeeklyPlan.findOne({
    user: req.user._id,
    status: "active",
    "assignMenu.assignedClients": customerId,
  });

  if (activeWeeklyPlan) {
    return res.status(200).json({
      status: "warning",
      message: req.t(
        "customers:validationErrors.customerAttachedToActiveWeeklyPlan",
      ),
    });
  }

  // Delete the customer
  customer.deletedAt = new Date();
  await customer.save();

  res.status(200).json({
    status: "success",
    message: req.t("customers:customerDeleted"),
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
    deletedAt: null,
  };

  // Add preferences, restrictions, and search query to the dbQuery
  if (preference && preference.length > 0) dbQuery.preferences = preference;
  if (status && status.length > 0) dbQuery.status = status;
  if (gender && gender.length > 0) dbQuery.gender = gender;
  if (query && query.length > 0) {
    dbQuery.$or = [
      { firstName: { $regex: query, $options: "i" } },
      { lastName: { $regex: query, $options: "i" } },
    ];
  }

  // Get the total number of documents and the documents for the current page
  const [total, totalForFetch, customers] = await Promise.all([
    Customer.countDocuments({ supplier: req.user._id, deletedAt: null }),
    Customer.countDocuments(dbQuery),
    Customer.find(dbQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .select(" -__v -createdAt -updatedAt")
      .lean(),
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

/**
 * Function to change customer status to active
 */
exports.changeCustomerStatusToActive = catchAsync(async (req, res, next) => {
  const { customer } = req;

  customer.status = "active";
  await customer.save();

  const messageBody = {
    status: "success",
    message: req.t("customers:customerStatusUpdated"),
  };

  if (req.warning) {
    messageBody.warning = req.warning;
  }

  res.status(200).json(messageBody);
});

/**
 * Function to change customer status to inactive
 */
exports.changeCustomerStatusToInactive = catchAsync(async (req, res, next) => {
  const { customer } = req;

  customer.status = "inactive";
  await customer.save();

  res.status(200).json({
    status: "success",
    message: req.t("customers:customerStatusUpdated"),
  });
});

/**
 * Middleware to check if customer is attached to any active weekly plan
 */
exports.checkDoesCustomerExistInWeeklyPlan = catchAsync(
  async (req, res, next) => {
    const { id: customerId } = req.params;

    // Find the customer by ID
    const customer = await Customer.findOne({
      _id: customerId,
      supplier: req.user._id,
      deletedAt: null,
    });

    // If customer does not exist, return an error
    if (!customer) {
      return next(
        new AppError(req.t("customers:validationErrors.customerNotFound"), 404),
      );
    }

    // Check if the customer is attached on active week plan
    const activeWeeklyPlan = await WeeklyPlan.findOne({
      user: req.user._id,
      status: "active",
      "assignMenu.assignedClients": customerId,
    });

    if (activeWeeklyPlan) {
      return res.status(200).json({
        status: "warning",
        message: req.t(
          "customers:validationErrors.customerAttachedToActiveWeeklyPlan",
        ),
      });
    }

    req.customer = customer;
    next();
  },
);

/**
 * Function to change customer menu quantity
 */
exports.changeCustomerMenuQuantity = catchAsync(async (req, res, next) => {
  const { id: customerId } = req.params;
  const { menuQuantity } = req.body;

  // Check if customer ID is provided
  if (!customerId) {
    return next(
      new AppError(req.t("customers:validationErrors.customerIdRequired"), 400),
    );
  }

  // Find the customer by ID
  const customer = await Customer.findOne({
    _id: customerId,
    supplier: req.user._id,
    deletedAt: null,
  });

  // If customer does not exist, return an error
  if (!customer) {
    return next(
      new AppError(req.t("customers:validationErrors.customerNotFound"), 404),
    );
  }

  // Check if customer is attached to any active week plan if yes than throw error and inform supplier that customer is attached to active week plan
  const activeWeeklyPlan = await WeeklyPlan.findOne({
    user: req.user._id,
    status: "active",
    "assignMenu.assignedClients": customerId,
  });

  if (activeWeeklyPlan) {
    return res.status(200).json({
      status: "warning",
      message: req.t(
        "customers:validationErrors.customerAttachedToActiveWeeklyPlan",
      ),
    });
  }

  // if customer is not attached to any active week plan than change the menu quantity
  customer.weeklyMenuQuantity = menuQuantity;
  await customer.save();

  res.status(200).json({
    status: "success",
    message: req.t("customers:customerMenuQuantityUpdated"),
  });
});

/**
 * Function to calculate the recommended nutrition for a customer
 */
exports.calculateRecommendedNutrition = catchAsync(async (req, res, next) => {
  const { id: customerId } = req.params;

  // Check if customer ID is provided
  if (!customerId) {
    return next(
      new AppError(req.t("customers:validationErrors.customerIdRequired"), 400),
    );
  }

  // Find the customer by ID
  const customer = await Customer.findById(customerId);

  // If customer does not exist, return an error
  if (!customer) {
    return next(
      new AppError(req.t("customers:validationErrors.customerNotFound"), 404),
    );
  }

  // Check customer status
  if (customer.status === "pending") {
    return next(
      new AppError(
        req.t("customers:validationErrors.customerFormNotSubmitted"),
        400,
      ),
    );
  }

  // Calculate the recommended nutrition
  const recommendedNutrition = await calculateDailyNutritionIntake(
    {
      gender: customer.gender,
      age: customer.age,
      height: customer.height,
      weight: customer.weight,
      fitnessGoal: customer.fitnessGoal,
      physicalActivityLevel: customer.physicalActivityLevel,
      preference: customer?.preferences[0] ?? null,
    },
    req,
    next,
  );

  if (!recommendedNutrition) {
    return next(
      new AppError(
        req.t("customers:validationErrors.nutritionCalculationFailed"),
        400,
      ),
    );
  }

  customer.recommendedNutrition = recommendedNutrition;
  await customer.save();

  res.status(200).json({
    status: "success",
    message: req.t("customers:customerNutritionCalculated"),
    data: customer.recommendedNutrition,
  });
});
