const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

const { connectRedis } = require("./src/integrations/redis");
connectRedis();

const { initializeBrowser } = require("./src/integrations/urlScreenshot.js");
initializeBrowser();

const app = express();

app.use(
  "/data",
  express.static(path.join(__dirname, "data"), {
    maxAge: 0,
    etag: false,
  })
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());

app.use("/auth", require("./src/routes/auth.route"));
app.use("/calls", require("./src/routes/call.route"));
app.use("/call-tags", require("./src/routes/callTag.route"));
app.use("/businesses", require("./src/routes/business.route"));
app.use("/users", require("./src/routes/user.route"));
app.use("/invitations", require("./src/routes/invitation.route"));
app.use("/train", require("./src/routes/train.route"));
app.use("/agents", require("./src/routes/agent.route"));
app.use("/voices", require("./src/routes/voice.route"));
app.use("/download", require("./src/routes/download.route"));
app.use("/team-groups", require("./src/routes/teamGroup.route"));
app.use("/integrations", require("./src/routes/integration.route"));
// app.use("/chats", require("./src/routes/chat.route"));

app.get("/", (req, res) => {
  res.status(200).json({ token: "Server is running..." });
});

app.post("/test", async (req, res) => {
  res.status(200).json({ response: "Test" });
});

app.listen(process.env.PORT, () => {
  console.log(`Server is running at http://localhost:${process.env.PORT}`);
});
