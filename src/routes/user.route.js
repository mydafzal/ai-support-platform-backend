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
const ResponseHandler = require("../utils/response-handler");
const { emailSchema } = require("../validators/auth.validator");
const ChatService = require("../services/chat.service");
const validateRequest = require("../middleware/request-validation.middleware");
const asyncHandler = require("../utils/async-handler");
const PricingPlanService = require("../services/pricing-plan.service");
const PaymentMethodService = require("../services/payment-method.service");

const storage = multer.diskStorage({
  destination: path.join(STORAGE_BASE_PATH, `profile-images`),
  filename: (req, file, cb) => {
    const uniqueFilename = uuidv4() + "-" + file.originalname;
    cb(null, uniqueFilename);
  },
});

const upload = multer({ storage });

router.post(
  "/",
  validateRequest(addUserSchema),
  asyncHandler(async (req, res) => {
    const token = await UserService.registerUser(req.body);

    ResponseHandler.success(res, {
      statusCode: 201,
      data: token,
      message: "Email verification link sent.",
    });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await UserService.removeUserFromBusiness({ userId: req.params.id });

    ResponseHandler.success(res, { statusCode: 204 });
  })
);

router.patch(
  "/:id",
  validateRequest(updateUserSchema),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const result = await UserService.updateUser({
      userId: req.params.id,
      ...req.body,
      file: req.file,
    });

    ResponseHandler.success(res, {
      data: result,
    });
  })
);

router.get(
  "/:id/chat-assignments",
  validateRequest(unviewedChatsSchema),
  asyncHandler(async (req, res) => {
    const data = { viewed: req.query.viewed, userId: req.params.id };

    const result = await ChatService.getUnviewedChatsCount(data);
    ResponseHandler.success(res, { data: result });
  })
);

router.post(
  "/check-email",
  validateRequest(emailSchema),
  asyncHandler(async (req, res) => {
    const available = await UserService.checkEmailAvailability(req.body);

    ResponseHandler.success(res, {
      data: { available },
    });
  })
);

router.get(
  "/:id/businesses",
  asyncHandler(async (req, res) => {
    const result = await UserService.getBusinessesOfUser({
      userId: req.params.id,
    });

    ResponseHandler.success(res, {
      data: result,
    });
  })
);

router.get(
  "/:id/pricing-plans",
  asyncHandler(async (req, res) => {
    const pricingPlans = await PricingPlanService.getPricingPlans({
      userId: req.params.id,
      businessId: req.query.businessId,
    });

    ResponseHandler.success(res, { data: pricingPlans });
  })
);

router.post(
  "/:id/payment-methods",
  asyncHandler(async (req, res) => {
    const clientSecret = await PaymentMethodService.addPaymentMethod({
      userId: req.params.id,
    });

    ResponseHandler.success(res, { data: { clientSecret } });
  })
);

router.get(
  "/:id/payment-methods",
  asyncHandler(async (req, res) => {
    const result = await PaymentMethodService.getPaymentMethodByBusiness({
      userId: req.params.id,
    });

    ResponseHandler.success(res, { data: result });
  })
);

router.delete(
  "/:id/payment-methods/:methodId",
  asyncHandler(async (req, res) => {
    await PaymentMethodService.deletePaymentMethod({
      userId: req.params.id,
      paymentMethodId: req.params.methodId,
    });

    ResponseHandler.success(res, { statusCode: 204 });
  })
);

router.patch(
  "/:id/payment-methods/:methodId",
  asyncHandler(async (req, res) => {
    await PaymentMethodService.setDefaultPaymentMethod({
      userId: req.params.id,
      paymentMethodId: req.params.methodId,
    });

    ResponseHandler.success(res, { message: "Payment method set as default." });
  })
);

module.exports = router;
