const Router = require("express").Router;
const router = Router();

const { Op, Sequelize } = require("sequelize");
const {
  Business,
  PricingPlan,
  Subscription,
  SubscriptionFeature,
  Feature,
} = require("../../models");

const { calculateYearlyPrice } = require("../utils/helpers");
const {
  handleSubscriptionCancellation,
} = require("../services/subscription.service");

const validateRequest = require("../middleware/requestValidation.middleware");

const {
  createSubscriptionSchema,
} = require("../validators/subscription.validator");

const SubscriptionService = require("../services/subscription.service");
const ResponseHandler = require("../utils/responseHandler");

router.post(
  "/",
  validateRequest(createSubscriptionSchema),
  async (req, res, next) => {
    try {
      const subscription = await SubscriptionService.createSubscription(
        req.body
      );
      ResponseHandler.success(res, subscription);
    } catch (error) {
      next(error);
    }
  }
);

router.put("/:id", async (req, res) => {
  try {
    const { success, error } =
      await updateSubscriptionValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }

    const subscriptionId = req.params.id;
    const { newPlanId, billingCycle, customizedFeatures = [] } = req.body;

    let subscription = await Subscription.findByPk(subscriptionId, {
      include: [
        {
          model: Business,
          as: "business",
        },
      ],
    });

    if (!subscription) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid subscription id." });
    }

    subscription = subscription.toJSON();

    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    const subscriptionItem = stripeSubscription.items.data[0];
    const currentSubscriptionPrice = subscriptionItem.price;

    const currentBillingCycle =
      currentSubscriptionPrice.recurring.interval === "month"
        ? "monthly"
        : "yearly";

    // Check if the new subscription changes are the same as current subscription details:

    const hasPlanChanged =
      !newPlanId || (newPlanId && newPlanId === subscription.planId);

    if (
      hasPlanChanged &&
      currentBillingCycle === billingCycle &&
      customizedFeatures.length < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "No changes were identified in the subscrption.",
      });
    }

    let pricingPlan = await PricingPlan.findByPk(
      newPlanId || subscription.planId
    );

    if (!pricingPlan) {
      return res.status(400).json({
        success: false,
        message: "Invalid pricing plan id.",
      });
    }

    pricingPlan = pricingPlan.toJSON();

    let basePrice = pricingPlan.monthlyBasePrice;
    let totalCost = parseFloat(basePrice);

    // Get all features that are included in the new plan:
    let newPlanFeatures = await Feature.findAll({
      include: [
        {
          model: PricingPlan,
          as: "plans",
          where: {
            id: newPlanId || subscription.planId,
          },
          through: {
            attributes: [],
          },
          attributes: [],
        },
      ],
      attributes: {
        include: [
          [Sequelize.col("plans.PlanFeature.baseQuantity"), "baseQuantity"],
        ],
        exclude: ["basePlanId"],
      },
    });

    newPlanFeatures = newPlanFeatures.map((item) => item.toJSON());

    // If features have been customized as part of updating the subscription:
    if (customizedFeatures.length > 0) {
      const customizedFeatureIds = new Set(
        customizedFeatures.map((item) => item.featureId)
      );

      const features = newPlanFeatures.filter((feature) =>
        customizedFeatureIds.has(feature.id)
      );

      let totalExtraCost = features.reduce((acc, feature) => {
        const customFeature = customizedFeatures.find(
          (item) => item.featureId === feature.id
        );

        const extraUnits =
          customFeature.quantity - parseInt(feature.baseQuantity, 10);
        const featureExtraCost = parseFloat(feature.unitPrice) * extraUnits;

        return acc + featureExtraCost;
      }, 0);

      totalCost += totalExtraCost;
    }

    if (billingCycle === "yearly") {
      totalCost = calculateYearlyPrice(
        totalCost,
        pricingPlan.yearlyDiscountPercentage
      );
    }

    const toalCostInCents = Math.round(totalCost * 100);

    const newSubscriptionPrice = await stripe.prices.create({
      currency: "usd",
      unit_amount: toalCostInCents,
      recurring: {
        interval: billingCycle === "monthly" ? "month" : "year",
      },
      product: pricingPlan.stripeProductId,
    });

    const paymentMethods = await stripe.customers.listPaymentMethods(
      subscription.business.stripeCustomerId,
      {
        limit: 1,
      }
    );

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [
        {
          id: subscriptionItem.id,
          deleted: true,
        },
        {
          price: newSubscriptionPrice.id,
        },
      ],
      default_payment_method: paymentMethods.data[0].id,
    });

    if (newPlanId) {
      await Subscription.update(
        {
          planId: pricingPlan.id,
        },
        {
          where: {
            id: subscription.id,
          },
        }
      );
    }

    // Remove features from user's subscription that are not included in the new plan.
    await SubscriptionFeature.destroy({
      where: {
        subscriptionId: subscription.id,
        featureId: {
          [Op.notIn]: newPlanFeatures.map((item) => item.id),
        },
      },
    });

    // Add features to user's subscription that are not currently in the subscription but are included in the new plan:
    const currentSubscriptionFeatures = await SubscriptionFeature.findAll({
      where: { subscriptionId: subscription.id },
      attributes: ["featureId"],
    });

    const currentFeatureIds = new Set(
      currentSubscriptionFeatures.map((item) => item.featureId)
    );

    let newPlanFeaturesNotInCurrentSubscription = newPlanFeatures.filter(
      (feature) => !currentFeatureIds.has(feature.id)
    );

    newPlanFeaturesNotInCurrentSubscription =
      newPlanFeaturesNotInCurrentSubscription.map((item) => ({
        featureId: item.id,
        subscriptionId: subscription.id,
        quantity: item.baseQuantity,
      }));

    await SubscriptionFeature.bulkCreate(
      newPlanFeaturesNotInCurrentSubscription
    );

    // 1. Reset the quantity of features that were customized in the previous plan but are not customized in the new plan:
    // 2. Set the quantity of features according to the customizations made to the new plan.

    const allFeatures = newPlanFeatures.map((feature) => {
      const customizedFeature = customizedFeatures.find(
        (customFeature) => customFeature.featureId === feature.id
      );

      return {
        featureId: feature.id,
        quantity: customizedFeature
          ? customizedFeature.quantity
          : feature.baseQuantity,
      };
    });

    const promises = allFeatures.map((feature) =>
      SubscriptionFeature.update(
        { quantity: feature.quantity },
        {
          where: {
            subscriptionId: subscription.id,
            featureId: feature.featureId,
          },
        }
      )
    );

    await Promise.all(promises);

    res
      .status(200)
      .json({ success: true, message: "Subscription updated succesfully." });
  } catch (error) {
    console.log("create subscription error - ", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    let subscription = await Subscription.findByPk(req.params.id);

    if (!subscription) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid subscription id." });
    }

    subscription = subscription.toJSON();

    // const stripeSubscription = await stripe.subscriptions.update(
    //   subscription.stripeSubscriptionId,
    //   {
    //     cancel_at_period_end: true,
    //   }
    // );

    const stripeSubscription = await stripe.subscriptions.cancel(
      subscription.stripeSubscriptionId
    );

    const response = {
      isScheduledForCancellation: stripeSubscription.cancel_at_period_end,
      currentPeriodEnd: stripeSubscription.current_period_end,
    };

    res.status(200).json({
      success: true,
      message: "Subscription cancelled succesfully.",
      data: response,
    });
  } catch (error) {
    console.log("create subscription error - ", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

router.post("/:id/resume", async (req, res) => {
  try {
    let subscription = await Subscription.findByPk(req.params.id);

    if (!subscription) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid subscription id." });
    }

    subscription = subscription.toJSON();

    const stripeSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: false,
      }
    );

    res.status(200).json({
      success: true,
      message: "Subscription resumed succesfully.",
      data: {
        isScheduledForCancellation: stripeSubscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    console.log("create subscription error - ", error);
    res.status(400).send({ error: { message: error.message } });
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
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    console.log("stripe webhooks error - ", error);
    res.status(500).send({ error: { message: error.message } });
  }
});

module.exports = router;
