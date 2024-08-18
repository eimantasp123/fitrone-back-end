require("dotenv").config();
const AWS = require("aws-sdk");
const sqs = new AWS.SQS({ region: "eu-north-1" });
const User = require("../models/User");
const verificationHelper = require("../helper/verificationHelper");
const connectDB = require("../config/dbConfig");
const { sendSMS } = require("../utils/awsHelper");

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
          console.log("Sending email verification code to:", user.email);
          await verificationHelper.sendEmailVerifyCodeToEmail(user);
          console.log("Email verification code sent to:", user.email);
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

// Function to process SMS verification SQS messages and send SMS verification code
const processSmsQueue = async () => {
  console.log("Processing SMS queue");
  const params = {
    QueueUrl: process.env.SMS_SQS_URL,
    MaxNumberOfMessages: 10,
  };

  try {
    const data = await sqs.receiveMessage(params).promise();
    if (data.Messages) {
      for (const message of data.Messages) {
        console.log("Sending SMS verification code");
        const { phone, code } = JSON.parse(message.Body);
        await sendSMS(phone, `Your 2FA code is ${code}`);
        console.log(
          "SMS verification code sent to:",
          phone,
          "and code is:",
          code,
        );
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
