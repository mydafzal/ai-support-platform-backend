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

const authRouter = require("./src/routes/auth.route");
const twilioRouter = require("./src/routes/twilio.route");
const customersRouter = require("./src/routes/customer.route");
const usersRouter = require("./src/routes/user.route");
const meetingEventsRouter = require("./src/routes/meetingEvent.route");
const dataLoaderRouter = require("./src/routes/data-loader.route");

const { convertTextToSpeech } = require("./src/text-to-speech");

const { connecteToDb } = require("./src/loaders/db");
const { uploadToBlobStorage } = require("./src/azure-storage");
const {
  initializeLangChain,
  generateAgentResponse,
  scrapeAndPersistData,
  readFileAndPersistData,
} = require("./src/experimentation/langchain");
const {
  addDataToChromaDB,
  getDataToChromaDB,
} = require("./src/experimentation/chroma-db");

app.get("/speech", async (req, res) => {
  const response = await convertTextToSpeech(
    // "Hey! I'm MichaelX, your friendly ai assistant. What would you like to talk about?"
    // "It's been a pleasure assisting you. Goodbye!",
    // "Hi, thanks for calling Cheetah. I am an AI assistant who can help you do all kinds of things, like setup a meeting or answer questions about the agency. If at any point you would like to speak to a person directly, please just say 'I'd like to speak to a human'",
    "Hi, thanks for calling Cheetah Agency. I'm Adam, an AI trained to help potential and current customers learn more about the agency and our storied history or schedule meetings with our engineers or creative team. I can also forward you to one of my favourite humans here at Cheetah. Just say 'I love humans' and I'll forward you. Anyways, tell me what you want to do - I can handle it."
  );

  res.status(200).json({ response });
});

app.post("/test", async (req, res) => {
  const { question } = req.body;
  console.log("question", question);

  // const response = await initializeLangChain();
  // const response = await addDataToChromaDB("");

  // const response = await scrapeAndPersistData(
  //   "https://cheetahagency.com/our-history/"
  // );

  // const response = await readFileAndPersistData();

  // const response = await generateAgentResponse("What is Cheetah Agency?");
  const response = await generateAgentResponse(question);
  res.status(200).json({ response });
});

app.use("/auth", authRouter);
app.use("/twilio", twilioRouter);
app.use("/customers", customersRouter);
app.use("/users", usersRouter);
app.use("/meeting-events", meetingEventsRouter);
app.use("/data-loader", dataLoaderRouter);

app.get("/", (req, res) => {
  res.status(200).json({ token: "token 123" });
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running at http://localhost:${process.env.PORT}`);
});
