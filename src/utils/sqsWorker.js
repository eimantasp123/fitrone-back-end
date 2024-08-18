require("dotenv").config();
const AWS = require("aws-sdk");
const sqs = new AWS.SQS({ region: "eu-north-1" });
const User = require("../models/User");
const verificationHelper = require("../helper/verificationHelper");
const connectDB = require("../config/dbConfig");
const { sendSMS } = require("../utils/awsHelper");

// Connect to database
connectDB();

// Function to process email verification SQS messages and send email verification code
const processEmailQueue = async () => {
  const params = {
    QueueUrl: process.env.EMAIL_SQS_URL,
    MaxNumberOfMessages: 10,
  };
  try {
    const data = await sqs.receiveMessage(params).promise();
    if (data.Messages) {
      for (const message of data.Messages) {
        const { userId } = JSON.parse(message.Body);
        const user = await User.findById(userId);
        if (user) {
          await verificationHelper.sendEmailVerifyCodeToEmail(user);
          await sqs
            .deleteMessage({
              QueueUrl: process.env.EMAIL_SQS_URL,
              ReceiptHandle: message.ReceiptHandle,
            })
            .promise();
        }
      }
    }
  } catch (error) {
    console.error("Error processing SQS messages:", error);
  }
};

// Function to process email send to reset password SQS messages and send email with reset password link
const processEmailSendToResetPasswordQueue = async () => {
  const params = {
    QueueUrl: process.env.EMAIL_VERIFY_CODE_SQS_URL,
    MaxNumberOfMessages: 10,
  };
  try {
    const data = await sqs.receiveMessage(params).promise();
    if (data.Messages) {
      for (const message of data.Messages) {
        const { userId } = JSON.parse(message.Body);
        const user = await User.findById(userId);
        if (user) {
          await verificationHelper.sendPasswordResetEmail(user);
          await sqs
            .deleteMessage({
              QueueUrl: process.env.EMAIL_VERIFY_CODE_SQS_URL,
              ReceiptHandle: message.ReceiptHandle,
            })
            .promise();
        }
      }
    }
  } catch (error) {
    console.error("Error processing SQS messages:", error);
  }
};

// Function to process SMS verification SQS messages and send SMS verification code
const processSmsQueue = async () => {
  const params = {
    QueueUrl: process.env.SMS_SQS_URL,
    MaxNumberOfMessages: 10,
  };

  try {
    const data = await sqs.receiveMessage(params).promise();
    if (data.Messages) {
      for (const message of data.Messages) {
        const { phone, code } = JSON.parse(message.Body);
        await sendSMS(phone, `Your 2FA code is ${code}`);
        await sqs
          .deleteMessage({
            QueueUrl: process.env.SMS_SQS_URL,
            ReceiptHandle: message.ReceiptHandle,
          })
          .promise();
      }
    }
  } catch (error) {
    console.error("Error processing SMS messages:", error);
  }
};

// Run the worker periodically
setInterval(processEmailQueue, 5000);
setInterval(processSmsQueue, 5000);
setInterval(processEmailSendToResetPasswordQueue, 5000);
