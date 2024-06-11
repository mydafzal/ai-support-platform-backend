const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");

// Load environment variables that are common across all environments
const dotenv = require("dotenv");
dotenv.config();

// Load environment-specific variables
const environmentOverridePath = path.resolve(
  __dirname,
  `.env.${process.env.NODE_ENV}`
);

if (fs.existsSync(environmentOverridePath)) {
  dotenv.config({ path: environmentOverridePath });
}

const { connectRedis } = require("./src/integrations/redis");
connectRedis();

const { initializeBrowser } = require("./src/integrations/urlScreenshot.js");
initializeBrowser();

const { createServer } = require("node:http");

const app = express();
const server = createServer(app);

const { initializeSocketIO } = require("./src/loaders/socket-io.js");
initializeSocketIO(server);

// app.use(
//   "/data",
//   express.static(path.join(__dirname, "data"), {
//     maxAge: 0,
//     etag: false,
//     setHeaders: (res) => {
//       res.setHeader("Cache-Control", "no-store");
//     },
//   })
// );

app.use(
  "/data",
  express.static(path.join(__dirname, "data"), {
    maxAge: "1d", // Default caching policy
    etag: true, // Default ETag behavior
    setHeaders: (res, filePath) => {
      const disableCachePaths = ["profile-images", "ai-generated-speeches"];

      const relativePath = path.relative(
        path.join(__dirname, "data"),
        filePath
      );

      if (
        disableCachePaths.some((disablePath) =>
          relativePath.startsWith(disablePath)
        )
      ) {
        res.setHeader("Cache-Control", "no-store");
        res.removeHeader("ETag"); // Remove ETag header if not needed
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400"); // Equivalent to 1 day
      }
    },
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
app.use("/form-links", require("./src/routes/form.route.js"));
app.use("/chats", require("./src/routes/chat.route.js"));
app.use("/chat-widgets", require("./src/routes/chatWidget.route.js"));
app.use(
  "/chat-assignments",
  require("./src/routes/chatUserAssignment.route.js")
);

app.get("/", (req, res) => {
  res.status(200).json({ token: "Server is running..." });
});

app.post("/test", async (req, res) => {
  res.status(200).json({ response: "Test" });
});

server.listen(process.env.PORT, () => {
  console.log(`Server is running at http://localhost:${process.env.PORT}`);
});
