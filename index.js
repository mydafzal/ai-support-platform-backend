const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

const { connectRedis } = require("./src/integrations/redis");
connectRedis();

const app = express();

app.use(express.json());
app.use(
  "/documents",
  express.static(path.join(__dirname, "documents"), {
    maxAge: 0,
    etag: false,
  })
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());

const authRouter = require("./src/routes/auth.route");
const callRouter = require("./src/routes/call.route");
const usersRouter = require("./src/routes/user.route");
const businessesRouter = require("./src/routes/business.route");
const meetingEventsRouter = require("./src/routes/meetingEvent.route");
const teachRouter = require("./src/routes/teach");
const agentsRouter = require("./src/routes/agent.route");
const voicesRouter = require("./src/routes/voice.route");
const downloadsRouter = require("./src/routes/download.route");

const {
  convertTextToSpeech,
  getElevenLabsVoices,
} = require("./src/integrations/textToSpeech");
const { queryCollection } = require("./src/integrations/chromaDB");

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
  await queryCollection("5444d469-7033-44f1-ae18-c67081127243");
  res.status(200).json({ response: "" });
});

app.use("/auth", authRouter);
app.use("/call", callRouter);
app.use("/businesses", businessesRouter);
app.use("/users", usersRouter);
app.use("/meeting-events", meetingEventsRouter);
app.use("/teach", teachRouter);
app.use("/agents", agentsRouter);
app.use("/voices", voicesRouter);
app.use("/download", downloadsRouter);

app.get("/", (req, res) => {
  res.status(200).json({ token: "token 123" });
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running at http://localhost:${process.env.PORT}`);
});
