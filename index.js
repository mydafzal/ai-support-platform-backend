const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");

const app = express();
const port = 5000;

// app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());

const authRouter = require("./src/authRouter");
const twilioRouter = require("./src/twilioRouter");
const { convertTextToSpeech } = require("./src/text-to-speech");
const { quickstart } = require("./src/speech-to-text");

app.get("/speech", async (req, res) => {
  const response = await convertTextToSpeech(
    "It's been a pleasure assisting you. Goodbye!"
  );

  // res.status(200).json({ response: "uniqueFilename" });
  res.status(200).json({ response });
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
