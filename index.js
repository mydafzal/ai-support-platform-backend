const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

require("./src/redis");

const app = express();

app.use(express.json());
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
const customerRouter = require("./src/routes/customer.route");

const { convertTextToSpeech } = require("./src/text-to-speech");
const { addVerifiedCallerId } = require("./src/controllers/twilio.controller");
const {
  storeCallData,
  getCallData,
  deleteCallData,
  updateCallData,
} = require("./src/redis");

const { connecteToDb } = require("./src/loaders/db");
connecteToDb();

app.get("/speech", async (req, res) => {
  const response = await convertTextToSpeech(
    // "Hey! I'm MichaelX, your friendly ai assistant. What would you like to talk about?"
    // "It's been a pleasure assisting you. Goodbye!",
    // "Hi, thanks for calling Cheetah. I am an AI assistant who can help you do all kinds of things, like setup a meeting or answer questions about the agency. If at any point you would like to speak to a person directly, please just say 'I'd like to speak to a human'",
    "Hi, thanks for calling Cheetah Agency. I'm Adam, an AI trained to help potential and current customers learn more about the agency and our storied history or schedule meetings with our engineers or creative team. I can also forward you to one of my favourite humans here at Cheetah. Just say 'I love humans' and I'll forward you. Anyways, tell me what you want to do - I can handle it."
  );

  res.status(200).json({ response });
});

app.get("/text", async (req, res) => {
  await storeCallData("customer-1", {
    name: "Hammad",
    data: 123,
  });

  const response1 = await getCallData("customer-1");

  // await updateCallData("customer-1", "data", "xyz");
  // const response2 = await getCallData("customer-1");

  // await deleteCallData("customer-1");
  // const response3 = await getCallData("customer-1");

  res.status(200).json({ response1 });
});

app.use("/auth", authRouter);
app.use("/twilio", twilioRouter);
app.use("/customers", customerRouter);

app.get("/", (req, res) => {
  res.status(200).json({ token: "token 123" });
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running at http://localhost:${process.env.PORT}`);
});
