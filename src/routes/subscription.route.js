const Router = require("express").Router;
const router = Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const { z } = require("zod");

const customizedFeatureSchema = z.object({
  featureId: z.number(),
  quantity: z.number(),
});

const createSubscriptionValidationSchema = z.object({
  businessId: z.number(),
  planId: z.number(),
  billingCycle: z.enum(["monthly", "yearly"]),
  customizedFeatures: z.array(customizedFeatureSchema).optional(),
});

const updateSubscriptionValidationSchema = z.object({
  newPlanId: z.number().optional(),
  billingCycle: z.enum(["monthly", "yearly"]),
  customizedFeatures: z.array(customizedFeatureSchema).optional(),
});

const { Op, Sequelize } = require("sequelize");
const {
  Business,
  PricingPlan,
  Subscription,
  SubscriptionFeature,
  PlanFeature,
  Feature,
} = require("../../models");
const { calculateYearlyPrice } = require("../utils/helpers");

router.post("/", async (req, res) => {
  try {
    const { success, error } =
      await createSubscriptionValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }

    const {
      businessId,
      planId,
      billingCycle,
      customizedFeatures = [],
    } = req.body;

    let business = await Business.findByPk(businessId);

    if (!business) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid business id." });
    }

    let pricingPlan = await PricingPlan.findByPk(planId);

    if (!pricingPlan) {
      return res.status(400).json({
        success: false,
        message: "Invalid pricing plan id.",
      });
    }

    business = business.toJSON();
    pricingPlan = pricingPlan.toJSON();

    if (!business.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: "Please add a payment method first.",
      });
    }

    const paymentMethods = await stripe.customers.listPaymentMethods(
      business.stripeCustomerId,
      {
        limit: 1,
      }
    );

    if (!paymentMethods || paymentMethods.data.length < 1) {
      return res.status(400).json({
        success: false,
        message: "Please add a payment method first.",
      });
    }

    // Determine actual price for the subscription based on billing cycle and customization of plan's features (if any)

    let basePrice;

    if (pricingPlan.name.toLowerCase() === "free") {
      basePrice = 0;
    } else {
      if (billingCycle === "monthly") {
        basePrice = pricingPlan.monthlyBasePrice;
      } else {
        basePrice = calculateYearlyPrice(
          pricingPlan.monthlyBasePrice,
          pricingPlan.yearlyDiscountPercentage
        );
      }
    }

    let totalCost = parseFloat(basePrice);

    if (customizedFeatures.length > 0) {
      const featureIds = customizedFeatures.map((item) => item.featureId);

      let features = await Feature.findAll({
        where: {
          id: {
            [Op.in]: featureIds,
          },
        },
        include: [
          {
            model: PricingPlan,
            as: "plans",
            where: {
              id: planId,
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

      features = features.map((item) => item.toJSON());

      let totalExtraCost = 0;

      features.forEach((feature) => {
        const customQuantity = customizedFeatures.find(
          (item) => item.featureId == feature.id
        ).quantity;

        const extraUnits = customQuantity - parseInt(feature.baseQuantity);
        const featureExtraCost =
          parseFloat(feature.unitPrice) * parseInt(extraUnits);

        totalExtraCost += featureExtraCost;
      });

      totalCost += totalExtraCost;
    }

    const toalCostInCents = Math.round(totalCost * 100);

    let subscription = await stripe.subscriptions.create({
      customer: business.stripeCustomerId,
      items: [
        {
          price_data: {
            currency: "USD",
            product: pricingPlan.stripeProductId,
            recurring: {
              interval: billingCycle === "monthly" ? "month" : "year",
            },
            unit_amount: toalCostInCents,
          },
        },
      ],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
    });

    // Free plans don't have payment intent. Checking if selected plan is not the FREE Plan:
    if (subscription.latest_invoice.payment_intent) {
      await stripe.paymentIntents.confirm(
        subscription.latest_invoice.payment_intent.id,
        {
          payment_method: paymentMethods.data[0].id,
        }
      );
    }

    subscription = await Subscription.create({
      stripeSubscriptionId: subscription.id,
      planId: pricingPlan.id,
      businessId: business.id,
    });

    subscription = subscription.toJSON();

    let featuresWithBaseQuantity;
    if (customizedFeatures.length > 0) {
      const customizedFeatureIds = customizedFeatures.map(
        (feature) => feature.featureId
      );

      featuresWithBaseQuantity = await PlanFeature.findAll({
        where: {
          planId,
          featureId: {
            [Op.notIn]: customizedFeatureIds,
          },
        },
      });
    } else {
      featuresWithBaseQuantity = await PlanFeature.findAll({
        where: {
          planId,
        },
      });
    }

    featuresWithBaseQuantity = featuresWithBaseQuantity.map((item) =>
      item.toJSON()
    );

    featuresWithBaseQuantity = featuresWithBaseQuantity.filter(
      (item) => item.baseQuantity && item.baseQuantity > 0
    );

    featuresWithBaseQuantity = featuresWithBaseQuantity.map((item) => {
      return {
        subscriptionId: subscription.id,
        featureId: item.featureId,
        quantity: item.baseQuantity,
        usedQuantity: 0,
      };
    });

    let featuresWithCustomQuantity = customizedFeatures.map((feature) => ({
      subscriptionId: subscription.id,
      featureId: feature.featureId,
      quantity: feature.quantity,
      usedQuantity: 0,
    }));

    const customizableFeatures = [
      ...featuresWithBaseQuantity,
      ...featuresWithCustomQuantity,
    ];

    await SubscriptionFeature.bulkCreate(customizableFeatures);

    res
      .status(200)
      .json({ success: true, message: "Subscription created succesfully." });
  } catch (error) {
    console.log("create subscription error - ", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

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

    if (customizedFeatures.length > 0) {
      const featureIds = customizedFeatures.map((item) => item.featureId);

      let features = await Feature.findAll({
        where: {
          id: {
            [Op.in]: featureIds,
          },
        },
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

      features = features.map((item) => item.toJSON());

      let totalExtraCost = 0;

      features.forEach((feature) => {
        const customQuantity = customizedFeatures.find(
          (item) => item.featureId == feature.id
        ).quantity;

        const extraUnits = customQuantity - parseInt(feature.baseQuantity);
        const featureExtraCost =
          parseFloat(feature.unitPrice) * parseInt(extraUnits);

        totalExtraCost += featureExtraCost;
      });

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

    let promises = [];

    // change from pro to enterprise: add companies feature to subscription-feature table
    // change from enterprise to pro: remove companies features from subscription-feature table
    // change from pro to enterprise: reset features without customization to base quantity, set custom quantity for customized features.

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
      where: {
        subscriptionId: subscription.id,
      },
      attributes: ["featureId"],
    });

    const currentSubscriptionFeatureIds = currentSubscriptionFeatures.map(
      (item) => item.toJSON().featureId
    );

    let newPlanFeaturesNotInCurrentSubscription = newPlanFeatures.filter(
      (feature) => !currentSubscriptionFeatureIds.includes(feature.id)
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

    // Now the subscription features are according to the new plan. Set the quantity of features according to the customizations made to the new plan.
    if (customizedFeatures.length > 0) {
      promises = customizedFeatures.map((feature) => {
        return SubscriptionFeature.update(
          {
            quantity: feature.quantity,
          },
          {
            where: {
              subscriptionId: subscription.id,
              featureId: feature.featureId,
            },
          }
        );
      });
    }

    await Promise.all(promises);

    // Reset the quantity of features that are both in previous and new plan, are not customized in the new plan and were customized in the previous plan...

    res
      .status(200)
      .json({ success: true, message: "Subscription updated succesfully." });
  } catch (error) {
    console.log("create subscription error - ", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

router.put("/:id/cancel", async (req, res) => {
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
        cancel_at_period_end: true,
      }
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

module.exports = router;
