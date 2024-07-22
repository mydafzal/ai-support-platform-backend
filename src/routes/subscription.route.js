const Router = require("express").Router;
const router = Router();

const {
  handleSubscriptionCancellation,
} = require("../services/subscription.service");

const validateRequest = require("../middleware/requestValidation.middleware");

const {
  createSubscriptionSchema,
  updateSubscriptionSchema,
} = require("../validators/subscription.validator");

const SubscriptionService = require("../services/subscription.service");
const ResponseHandler = require("../utils/responseHandler");

router.post(
  "/",
  validateRequest(createSubscriptionSchema),
  async (req, res, next) => {
    try {
      const result = await SubscriptionService.createSubscription(req.body);

      ResponseHandler.success(res, { statusCode: 201, message: result });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/:id",
  validateRequest(updateSubscriptionSchema),
  async (req, res, next) => {
    try {
      const subscriptionId = req.params.id;

      const result = await SubscriptionService.updateSubscription({
        subscriptionId,
        ...req.body,
      });

      ResponseHandler.success(res, { message: result });
    } catch (error) {
      next(error);
    }
  }
);

router.post("/:id/cancel", async (req, res, next) => {
  try {
    const result = await SubscriptionService.cancelSubscription({
      subscriptionId: req.params.id,
    });

    ResponseHandler.success(res, { data: result });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/resume", async (req, res, next) => {
  try {
    const result = await SubscriptionService.resumeSubscription({
      subscriptionId: req.params.id,
    });

    ResponseHandler.success(res, { data: result });
  } catch (error) {
    next(error);
  }
});

router.post("/stripe-webhooks", async (req, res) => {
  let event = req.body;

  try {
    switch (event.type) {
      case "customer.subscription.deleted":
        const cancelledSubscription = event.data.object;
        await handleSubscriptionCancellation(cancelledSubscription.id);
        break;

      case "invoice.payment_failed":
        console.log("invoice.payment_failed - ", event.data.object);
        // const cancelledSubscription = event.data.object;
        // await handleSubscriptionCancellation(cancelledSubscription.id);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    console.log("stripe webhooks error - ", error);
  }
});

module.exports = router;
