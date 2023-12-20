const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const port = 5000;

const ACCOUNT_SID = "AC4aaae2efa313920547b86dff276458a3";
const AUTH_TOKEN = "67f9c2f8b811476eb04321d59f68ff91";

const twilio = require("twilio");

app.use(express.json());
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
const { getUserById } = require("./src/firestore");
const { scheduleMeeting } = require("./src/controller");

app.get("/speech", async (req, res) => {
  const response = await convertTextToSpeech(
    // "Hey! I'm MichaelX, your friendly ai assistant. What would you like to talk about?"
    // "It's been a pleasure assisting you. Goodbye!",
    // "Hi, thanks for calling Cheetah. I am an AI assistant who can help you do all kinds of things, like setup a meeting or answer questions about the agency. If at any point you would like to speak to a person directly, please just say 'I'd like to speak to a human'",
    "Hi, thanks for calling Cheetah Agency. I'm Adam, an AI trained to help potential and current customers learn more about the agency and our storied history or schedule meetings with our engineers or creative team. I can also forward you to one of my favourite humans here at Cheetah. Just say 'I love humans' and I'll forward you. Anyways, tell me what you want to do - I can handle it."
  );

  // res.status(200).json({ response: "uniqueFilename" });
  res.status(200).json({ response });
});

app.get("/calendar", async (req, res) => {
  const response = getAvailableTimeSlots(new Date(), "");
  res.status(200).json({ response });
});

app.get("/text", async (req, res) => {
  res.status(200).json({ response: "" });
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
