const router = require("express").Router();
const path = require("path");

const { STORAGE_BASE_PATH } = require("../utils/constants");

const { v4: uuidv4 } = require("uuid");

const multer = require("multer");

const {
  addUserSchema,
  unviewedChatsSchema,
  updateUserSchema,
} = require("../validators/user.validator");

const UserService = require("../services/user.service");
const ResponseHandler = require("../utils/responseHandler");
const { emailSchema } = require("../validators/auth.validator");
const ChatService = require("../services/chat.service");
const validateRequest = require("../middleware/requestValidation.middleware");

const storage = multer.diskStorage({
  destination: path.join(STORAGE_BASE_PATH, `profile-images`),
  filename: (req, file, cb) => {
    const uniqueFilename = uuidv4() + "-" + file.originalname;
    cb(null, uniqueFilename);
  },
});

const upload = multer({ storage });

router.post("/", validateRequest(addUserSchema), async (req, res, next) => {
  try {
    const token = await UserService.registerUser(req.body);

    ResponseHandler.success(res, {
      statusCode: 201,
      data: token,
      message: "Email verification link sent.",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await UserService.removeUserFromBusiness({ userId: req.params.id });
    ResponseHandler.success(res, { statusCode: 204 });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:id",
  validateRequest(updateUserSchema),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const result = await UserService.updateUser({
        userId: req.params.id,
        ...req.body,
      });

      ResponseHandler.success(res, {
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:id/chat-assignments",
  validateRequest(unviewedChatsSchema),
  async (req, res, next) => {
    try {
      const data = { viewed: req.query.viewed, userId: req.params.id };

      const result = await ChatService.getUnviewedChatsCount(data);
      ResponseHandler.success(res, { data: result });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/check-email",
  validateRequest(emailSchema),
  async (req, res, next) => {
    try {
      const available = await UserService.checkEmailAvailability(req.body);
      ResponseHandler.success(res, {
        data: { available },
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
