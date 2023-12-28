const ACCOUNT_SID = "AC0ea48061c1c3c4fc80453e587912191f";
const API_KEY = "SK02d47ccec723de76f2cc160b515700b4";
const API_SECRET = "Njxq4cMzLqTNwNwXlUmP1QVuMyutnK20";
const TWIML_APP_SID = "AP6b57abe5bf5d09a9a42e30eda83a3556";
const AUTH_TOKEN = "11cc0d1ee279310ad0c7af5131efd7dc";
const VERIFY_SERVICE_SID = "VA6ce2779b9da4820716711c2b300d4dab";
const MESSAGING_SERVICE_SID = "MGa0a02a92b492d363da643620c0728958";

const client = require("twilio")(ACCOUNT_SID, AUTH_TOKEN);

async function buyPhoneNumber() {
  const availableNumbers = await client
    .availablePhoneNumbers("US")
    .local.list();

  const phoneNumberToPurchase = availableNumbers[0].phoneNumber;

  //   const purchasedNumber = await client.incomingPhoneNumbers.create({
  //     phoneNumber: phoneNumberToPurchase,
  //     friendlyName: "My Twilio Number",
  //   });

  //   console.log("purchasedNumber.sid", purchasedNumber.sid);
  console.log("available numbers", availableNumbers);
}

async function addVerifiedCallerId(phoneNumber) {
  const validationRequest = await client.validationRequests.create({
    friendlyName: "My Home Phone Number 2",
    phoneNumber: "+923055952372",
    // phoneNumber: "+923141560434",
  });

  const message = await client.messages.create({
    body: `Your 6-digit verification code is: ${validationRequest.validationCode}`,
    messagingServiceSid: MESSAGING_SERVICE_SID,
    to: phoneNumber,
  });

  console.log("validationCode=====", validationRequest.validationCode);
  console.log("message.sid=====", message.sid);
}

module.exports = { addVerifiedCallerId, buyPhoneNumber };
