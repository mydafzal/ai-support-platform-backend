const router = require("express").Router();
const { ChatWidget } = require("../../models");

const { z } = require("zod");
const path = require("path");
const fs = require("fs/promises");

const { v4: uuidv4 } = require("uuid");

const {
  CHAT_WIDGET_LOGOS_BASE_URL,
  STORAGE_BASE_PATH,
} = require("../utils/constants");

const multer = require("multer");
const storage = multer.diskStorage({
  destination: "documents",
  filename: (req, file, cb) => {
    const uniqueFilename = uuidv4() + "-" + file.originalname;
    cb(null, uniqueFilename);
  },
});

const upload = multer({ storage });

const createWidgetValidationSchema = z.object({
  name: z.string(),
  welcomeMessage: z.string(),
  colorHexCode: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color code."),
  businessId: z.coerce.number(),
});

const updateWidgetValidationSchema = z.object({
  name: z.string(),
  welcomeMessage: z.string(),
  colorHexCode: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color code."),
});

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file || req.file?.length < 1) {
    return res
      .status(400)
      .json({ success: false, message: "Provide a logo for the chatbot." });
  }

  try {
    const { success, error } =
      await createWidgetValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name, welcomeMessage, colorHexCode, businessId } = req.body;

    const destinationPath = path.join(STORAGE_BASE_PATH, `chat-widget-logos`);
    await fs.mkdir(destinationPath, { recursive: true });

    const sourcePath = path.join(__dirname, "..", "..", req.file.path);
    await fs.rename(sourcePath, `${destinationPath}/${req.file.filename}`);

    const logoUrl = `${CHAT_WIDGET_LOGOS_BASE_URL}/${req.file.filename}`;

    let chatWidget = await ChatWidget.create({
      name,
      welcomeMessage,
      logoUrl,
      colorHexCode,
      businessId,
    });

    res.status(201).json({
      success: true,
      data: chatWidget?.toJSON(),
    });
  } catch (error) {
    console.error("Error creating chat widget: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id", upload.single("file"), async (req, res) => {
  const chatWidgetId = req.params.id;

  try {
    const { success, error } =
      await updateWidgetValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    let chatWidget = await ChatWidget.findOne({
      where: {
        id: chatWidgetId,
      },
    });

    if (!chatWidget) {
      return res
        .status(400)
        .json({ success: true, message: "Invalid chat widget id." });
    }

    chatWidget = chatWidget.toJSON();

    if (req.file) {
      const destinationPath = path.join(STORAGE_BASE_PATH, `chat-widget-logos`);
      await fs.mkdir(destinationPath, { recursive: true });

      const sourcePath = path.join(__dirname, "..", "..", req.file.path);
      await fs.rename(sourcePath, `${destinationPath}/${req.file.filename}`);

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
    });

    res.status(200).json({
      success: true,
      data: chatWidget?.toJSON(),
    });
  } catch (error) {
    console.error("Error creating chat widget: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
