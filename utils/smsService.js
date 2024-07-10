const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

const verificationCodes = {};

const sendVerificationCode = async (phone) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  verificationCodes[phone] = code;
  await client.messages.create({
    body: `Your verification code is ${code}`,
    from: fromPhone,
    to: phone,
  });
  return code;
};

const verifyCode = (phone, code) => {
  return verificationCodes[phone] === code;
};

module.exports = {
  sendVerificationCode,
  verifyCode,
};
