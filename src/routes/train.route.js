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

const validateRequest = require("../middleware/requestValidation.middleware");
const TrainService = require("../services/train.service");

const ResponseHandler = require("../utils/responseHandler");

router.post(
  "/chat",
  validateRequest(teachChatSchema),
  async (req, res, next) => {
    try {
      const result = await TrainService.trainWithChat(req.body);
      ResponseHandler.success(res, { statusCode: 201, message: result });
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
);

router.post("/urls", validateRequest(addUrlsSchema), async (req, res, next) => {
  try {
    const result = await TrainService.trainWithUrls(req.body);
    ResponseHandler.success(res, { statusCode: 201, message: result });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.post(
  "/documents",
  validateRequest(addDocumentsSchema),
  upload.array("files"),
  async (req, res, next) => {
    try {
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
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
);

router.delete("/urls/:id", async (req, res, next) => {
  try {
    await TrainService.deleteUrl({ urlId: req.params.id });
    ResponseHandler.success(res, { statusCode: 204 });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

router.delete("/documents/:id", async (req, res, next) => {
  try {
    await TrainService.deleteDocument({ documentId: req.params.id });
    ResponseHandler.success(res, { statusCode: 204 });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

router.delete("/:name", async (req, res) => {
  await deleteCollection(req.params.name);
  res.send("deleted.");
});

module.exports = router;
