const router = require("express").Router();

const { deleteCollection } = require("../integrations/chromaDB");

const multer = require("multer");

const storage = multer.diskStorage({
  destination: "documents",
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

const {
  addUrlsSchema,
  addDocumentsSchema,
  teachChatSchema,
} = require("../validators/train.validator");

const validateRequest = require("../middleware/request-validation.middleware");
const TrainService = require("../services/train.service");

const ResponseHandler = require("../utils/response-handler");
const asyncHandler = require("../utils/async-handler");

router.post(
  "/chat",
  validateRequest(teachChatSchema),
  asyncHandler(async (req, res) => {
    const result = await TrainService.trainWithChat(req.body);

    ResponseHandler.success(res, { statusCode: 201, message: result });
  })
);

router.post(
  "/urls",
  validateRequest(addUrlsSchema),
  asyncHandler(async (req, res) => {
    const result = await TrainService.trainWithUrls(req.body);
    ResponseHandler.success(res, { statusCode: 201, message: result });
  })
);

router.post(
  "/documents",
  upload.array("files"),
  validateRequest(addDocumentsSchema),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length < 1) {
      throw {
        statusCode: 400,
        message: "Provide one or more files",
      };
    }

    const result = await TrainService.trainWithDocuments({
      ...req.body,
      files: req.files,
    });

    ResponseHandler.success(res, { statusCode: 201, message: result });
  })
);

router.delete(
  "/urls/:id",
  asyncHandler(async (req, res) => {
    await TrainService.deleteUrl({ urlId: req.params.id });
    ResponseHandler.success(res, { statusCode: 204 });
  })
);

router.delete(
  "/documents/:id",
  asyncHandler(async (req, res) => {
    await TrainService.deleteDocument({ documentId: req.params.id });
    ResponseHandler.success(res, { statusCode: 204 });
  })
);

router.delete("/:name", async (req, res) => {
  await deleteCollection(req.params.name);
  res.send("deleted.");
});

module.exports = router;
