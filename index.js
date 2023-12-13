const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const port = 5000;

const ACCOUNT_SID = "AC4aaae2efa313920547b86dff276458a3";
const AUTH_TOKEN = "67f9c2f8b811476eb04321d59f68ff91";
const client = require("twilio")(
  "AC4aaae2efa313920547b86dff276458a3",
  "67f9c2f8b811476eb04321d59f68ff91"
);

// app.use(express.json());
// app.use("/public", express.static("public"));
app.use(
  "/public",
  express.static(path.join(__dirname, "public"), {
    maxAge: 0,
    etag: false,
  })
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());

const authRouter = require("./src/authRouter");
const twilioRouter = require("./src/twilioRouter");
const { convertTextToSpeech } = require("./src/text-to-speech");
const { quickstart } = require("./src/speech-to-text");
const { getAvailableTimeSlots } = require("./src/calendly");

app.get("/speech", async (req, res) => {
  const response = await convertTextToSpeech(
    // "Hey! I'm MichaelX, your friendly ai assistant. What would you like to talk about?"
    // "It's been a pleasure assisting you. Goodbye!",
    "Hi, thanks for calling Cheetah. I am an AI assistant who can help you do all kinds of things, like setup a meeting or answer questions about the agency. If at any point you would like to speak to a person directly, please just say 'I'd like to speak to a human'"
  );

  // res.status(200).json({ response: "uniqueFilename" });
  res.status(200).json({ response });
});

app.get("/calendar", async (req, res) => {
  // const response = getAvailableTimeSlots();
  // res.status(200).json({ response });

  // client.validationRequests
  //   .create({
  //     friendlyName: "My Home Phone Number",
  //     phoneNumber: "+923055952372",
  //   })
  //   .then((validation_request) => console.log(validation_request.friendlyName));

  client.calls
    .create({
      twiml: "<Response><Say>Ahoy there!</Say></Response>",
      to: "+923201403392",
      from: "+12057402083",
    })
    .then((call) => call);
});

app.get("/text", async (req, res) => {
  const response = await quickstart();
  res.status(200).json({ response });
});

app.use("/auth", authRouter);
app.use("/twilio", twilioRouter);

app.get("/", (req, res) => {
  // res.send("Hello, Express!");
  res.status(200).json({ token: "token 123" });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
