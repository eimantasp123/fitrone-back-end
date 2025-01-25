require("dotenv").config(); // Load environment variables
const AWS = require("aws-sdk");
const sqs = new AWS.SQS();
const sns = new AWS.SNS();

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
    await sns.publish(params).promise();
  } catch (error) {
    console.error("Error sending SMS:", error);
  }
};

// Helper function to send message to SQS queue
const sendMessageToQueue = async (messageBody, queueUrl) => {
  const params = {
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(messageBody),
  };
  try {
    await sqs.sendMessage(params).promise();
  } catch (error) {
    console.error("Error processing SQS messages:", error);
  }
};

module.exports = { sendMessageToQueue, sendSMS };
