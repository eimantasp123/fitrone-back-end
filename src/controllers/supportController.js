const Support = require("../models/Support");
const SystemProblem = require("../models/SystemProblem");
const AppError = require("../utils/appError");
const { sendMessageToQueue } = require("../utils/awsHelper");
const catchAsync = require("../utils/catchAsync");

/**
 * Send a support message.
 */
exports.support = catchAsync(async (req, res, next) => {
  const { message, subject, email, name } = req.body;

  // Check if the required fields are provided
  if (!message || !subject) {
    return next(new AppError(req.t("error.missingMessageOrSubject"), 400));
  }

  // Create message and save it
  const support = await Support.create({
    name,
    email,
    message,
    subject,
    user: req.user._id,
  });

  support.save();

  const messageBody = {
    template: "template-email-support",
    data: {
      emailSubject: "Support Message",
      emailTitle: `Message from ${name}`,
      subject,
      message,
      problem: "None",
      customerEmail: req.user.email,
    },
  };

  // Send message to the queue
  await sendMessageToQueue(
    messageBody,
    process.env.EMAIL_SQS_SEND_TO_SUPPORT_QUEUE_URL,
  );

  // Send response
  return res.status(200).json({
    status: "success",
    message: req.t("supportMessageSent"),
  });
});

/**
 * Send a support message for system problems.
 */
exports.systemSupport = catchAsync(async (req, res, next) => {
  const { message, problem } = req.body;

  // Check if the required fields are provided
  if (!message || !problem) {
    return next(
      new AppError(req.t("error.missingMessageOrSystemProblem"), 400),
    );
  }

  // Create message and save it
  const problemObj = await SystemProblem.create({
    name: req.user.firstName,
    email: req.user.email,
    message,
    problem,
    user: req.user._id,
  });

  problemObj.save();

  const messageBody = {
    template: "template-email-support",
    data: {
      emailSubject: "System Problem Message",
      emailTitle: `Message from ${req.user.firstName}`,
      subject: "System Problem",
      message,
      problem: problem,
      customerEmail: req.user.email,
    },
  };

  // Send message to the queue
  await sendMessageToQueue(
    messageBody,
    process.env.EMAIL_SQS_SEND_TO_SUPPORT_QUEUE_URL,
  );

  // Send response
  return res.status(200).json({
    status: "success",
    message: req.t("supportMessageSent"),
  });
});
