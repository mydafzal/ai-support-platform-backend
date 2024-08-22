const router = require("express").Router();

const { v4: uuidv4 } = require("uuid");

const multer = require("multer");

const path = require("path");

const { getSocketIOInstance } = require("../loaders/socket-io");
const { STORAGE_BASE_PATH } = require("../utils/constants");

const {
  preChatFormSchema,
  chatMessageSchema,
  updateChatSchema,
  chatFileUploadsSchema,
} = require("../validators/chat.validator");

const validateRequest = require("../middleware/request-validation.middleware");
const ChatService = require("../services/chat.service");
const ResponseHandler = require("../utils/response-handler");
const asyncHandler = require("../utils/async-handler");

const storage = multer.diskStorage({
  destination: path.join(STORAGE_BASE_PATH, `chat-uploads`),
  filename: (req, file, cb) => {
    const uniqueFilename = uuidv4() + "-" + file.originalname;
    cb(null, uniqueFilename);
  },
});

const upload = multer({ storage });

router.post(
  "/",
  validateRequest(preChatFormSchema),
  asyncHandler(async (req, res) => {
    const result = await ChatService.createChat(req.body);

    ResponseHandler.success(res, { data: result });
  })
);

router.put(
  "/:id/pre-chat-form",
  validateRequest(preChatFormSchema),
  asyncHandler(async (req, res) => {
    const result = await ChatService.updatePreChatForm({
      chatId: req.params.id,
      ...req.body,
    });

    ResponseHandler.success(res, { data: result });
  })
);

router.post(
  "/:id/messages",
  validateRequest(chatMessageSchema),
  asyncHandler(async (req, res) => {
    const result = await ChatService.sendMessage({
      chatId: req.params.id,
      ...req.body,
    });

    ResponseHandler.success(res, { data: result });
  })
);

router.get(
  "/:id/messages",
  asyncHandler(async (req, res) => {
    const messages = await ChatService.getMessagesByChat({
      chatId: req.params.id,
    });

    ResponseHandler.success(res, { success: true, data: messages });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    let chat = await ChatService.getChatById({ chatId: req.params.id });
    ResponseHandler.success(res, { success: true, data: chat });
  })
);

router.patch(
  "/:id",
  validateRequest(updateChatSchema),
  asyncHandler(async (req, res) => {
    const result = await ChatService.updateChat({
      chatId: req.params.id,
      ...req.body,
    });

    ResponseHandler.success(res, {
      data: result,
    });
  })
);

router.post(
  "/:id/upload",
  validateRequest(chatFileUploadsSchema),
  upload.array("files"),
  async (req, res) => {
    if (!req.files || req.files.length < 1) {
      return ResponseHandler.error(res, {
        statusCode: 400,
        message: "Please provide one or more files to upload.",
      });
    }

    const chatId = req.params.id;
    const userId = req.body.userId;

    console.log("req.files - ", req.files);

    const { chat, messages } = await ChatService.uploadFilesInChat({
      chatId,
      userId,
      files: req.files,
    });

    ResponseHandler.success(res, { data: messages });

    process.nextTick(() => {
      const io = getSocketIOInstance();

      let receiverId;
      if (userId) receiverId = `chat-${chatId}`;
      else receiverId = `${chat.connectedUserId}`;

      io.to(receiverId).emit("chat:new-message", { chatId, messages });
    });
  }
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await ChatService.deleteChat({ chatId: req.params.id });
    ResponseHandler.success(res, { statusCode: 204 });
  })
);

module.exports = router;
