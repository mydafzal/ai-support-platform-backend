const router = require("express").Router();
const { ChatWidget, Business } = require("../../models");

const path = require("path");
const fs = require("fs/promises");

const { v4: uuidv4 } = require("uuid");

const {
  CHAT_WIDGET_LOGOS_BASE_URL,
  STORAGE_BASE_PATH,
} = require("../utils/constants");

const validateRequest = require("../middleware/request-validation.middleware");
const {
  createWidgetSchema,
  updateWidgetSchema,
} = require("../validators/chat-widget.validator");

const ResponseHandler = require("../utils/response-handler");
const asyncHandler = require("../utils/async-handler");

const multer = require("multer");

const storage = multer.diskStorage({
  destination: path.join(STORAGE_BASE_PATH, `chat-widget-logos`),
  filename: (req, file, cb) => {
    const uniqueFilename = uuidv4() + "-" + file.originalname;
    cb(null, uniqueFilename);
  },
});

const upload = multer({ storage });

router.post(
  "/",
  upload.single("file"),
  validateRequest(createWidgetSchema),
  asyncHandler(async (req, res) => {
    if (!req.file || req.file?.length < 1) {
      throw { statusCode: 400, message: "Provide a logo for the chatbot." };
    }

    const { name, welcomeMessage, colorHexCode, businessId } = req.body;

    const logoUrl = `${CHAT_WIDGET_LOGOS_BASE_URL}/${req.file.filename}`;

    const business = await Business.findByPk(businessId, { raw: true });

    if (!business) {
      throw { statusCode: 400, message: "Invalid business id." };
    }

    let chatWidget = await ChatWidget.create({
      name,
      welcomeMessage,
      logoUrl,
      colorHexCode,
      businessId,
    });

    ResponseHandler.success(res, {
      statusCode: 201,
      data: chatWidget?.toJSON(),
    });
  })
);

router.put(
  "/:id",
  upload.single("file"),
  validateRequest(updateWidgetSchema),
  asyncHandler(async (req, res) => {
    const chatWidgetId = req.params.id;

    let chatWidget = await ChatWidget.findOne({
      where: {
        id: chatWidgetId,
      },
      raw: true,
    });

    if (!chatWidget) {
      throw { statusCode: 404, message: "Invalid chat widget id." };
    }

    if (req.file) {
      req.body.logoUrl = `${CHAT_WIDGET_LOGOS_BASE_URL}/${req.file.filename}`;

      // Remove existing file by first extracting file name from existing logo url.
      const logoUrlChunks = chatWidget.logoUrl.split("/");
      const filename = logoUrlChunks[logoUrlChunks.length - 1];

      const filePath = path.join(
        STORAGE_BASE_PATH,
        `chat-widget-logos`,
        filename
      );

      await fs.rm(filePath);
    }

    await ChatWidget.update(
      {
        ...req.body,
      },
      {
        where: {
          id: chatWidgetId,
        },
      }
    );

    chatWidget = await ChatWidget.findOne({
      where: {
        id: chatWidgetId,
      },
      raw: true,
    });

    ResponseHandler.success(res, {
      data: chatWidget,
    });
  })
);

module.exports = router;
