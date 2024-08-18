const AWS = require("aws-sdk");
const sns = new AWS.SNS({ region: "eu-north-1" });
const sqs = new AWS.SQS({ region: "eu-north-1" });

// Helper function to send SMS using AWS SNS service
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
    console.log("SMS sent to publish:", phone);
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

module.exports = { sendSMS, sendMessageToQueue };
