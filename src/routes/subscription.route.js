const Router = require("express").Router;
const router = Router();

const validateRequest = require("../middleware/request-validation.middleware");

const {
  createSubscriptionSchema,
  updateSubscriptionSchema,
} = require("../validators/subscription.validator");

const SubscriptionService = require("../services/subscription.service");
const ResponseHandler = require("../utils/response-handler");
const asyncHandler = require("../utils/async-handler");

router.post(
  "/",
  validateRequest(createSubscriptionSchema),
  asyncHandler(async (req, res) => {
    const result = await SubscriptionService.createSubscription(req.body);

    ResponseHandler.success(res, { statusCode: 201, message: result });
  })
);

router.put(
  "/:id",
  validateRequest(updateSubscriptionSchema),
  asyncHandler(async (req, res) => {
    const subscriptionId = req.params.id;

    const result = await SubscriptionService.updateSubscription({
      subscriptionId,
      ...req.body,
    });

    ResponseHandler.success(res, { message: result });
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const result = await SubscriptionService.cancelSubscription({
      subscriptionId: req.params.id,
    });

    ResponseHandler.success(res, { data: result });
  })
);

router.post(
  "/:id/resume",
  asyncHandler(async (req, res) => {
    const result = await SubscriptionService.resumeSubscription({
      subscriptionId: req.params.id,
    });

    ResponseHandler.success(res, { data: result });
  })
);

router.post(
  "/stripe-webhooks",
  asyncHandler(async (req) => {
    let event = req.body;

    switch (event.type) {
      case "customer.subscription.deleted":
        await SubscriptionService.handleSubscriptionCancellation(
          event.data.object
        );
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  })
);

module.exports = router;
