const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

// Initialize AWS SDK clients
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

/**
 * Function to send an SMS using AWS SNS
 * @param {string} phone - The recipient phone number
 * @param {string} message - The message content
 */
const sendSMS = async (phone, message) => {
  const params = {
    Message: message,
    PhoneNumber: phone,
    MessageAttributes: {
      "AWS.SNS.SMS.SenderID": {
        DataType: "String",
        StringValue: "Fitrone",
      },
      "AWS.SNS.SMS.SMSType": {
        DataType: "String",
        StringValue: "Transactional",
      },
    },
  };
  try {
    // Send SMS to user phone number
    const command = new PublishCommand(params);
    await snsClient.send(command);
  } catch (error) {
    console.error("Error sending SMS:", error);
  }
};

/**
 * Function to send a message to an AWS SQS queue
 * @param {Object} messageBody - The message body (object)
 * @param {string} queueUrl - The SQS queue URL
 */
const sendMessageToQueue = async (messageBody, queueUrl) => {
  const params = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(messageBody),
  };
  try {
    const command = new SendMessageCommand(params);
    await sqsClient.send(command);
  } catch (error) {
    console.error("Error processing SQS messages:", error);
  }
};

module.exports = { sendMessageToQueue, sendSMS };
