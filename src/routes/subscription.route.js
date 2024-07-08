const Router = require("express").Router;
const router = Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const { Op, Sequelize } = require("sequelize");
const {
  Business,
  PricingPlan,
  Subscription,
  SubscriptionFeature,
  Feature,
} = require("../../models");
const { calculateYearlyPrice } = require("../utils/helpers");

router.post("/", async (req, res) => {
  const { businessId, planId, billingCycle, customizedFeatures } = req.body;

  try {
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

    if (pricingPlan.name.toLowerCase() === "free") {
      await Subscription.create({
        planId: pricingPlan.id,
        businessId: business.id,
        billingCycle,
        startDate: Date.now(),
        price: 0,
      });

      return res
        .status(200)
        .json({ success: true, message: "Subscription created succesfully." });
    }

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

    const basePrice =
      billingCycle === "monthly"
        ? pricingPlan.monthlyBasePrice
        : calculateYearlyPrice(
            pricingPlan.monthlyBasePrice,
            pricingPlan.yearlyDiscountPercentage
          );

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

    await stripe.paymentIntents.confirm(
      subscription.latest_invoice.payment_intent.id,
      {
        payment_method: paymentMethods.data[0].id,
      }
    );

    subscription = await Subscription.create({
      stripeSubscriptionId: subscription.id,
      planId: pricingPlan.id,
      businessId: business.id,
      billingCycle,
      startDate: Date.now(),
      price: totalCost,
    });

    subscription = subscription.toJSON();

    let subscriptionFeatures = customizedFeatures.map((feature) => ({
      subscriptionId: subscription.id,
      featureId: feature.featureId,
      quantity: feature.quantity,
    }));

    await SubscriptionFeature.bulkCreate(subscriptionFeatures);

    res
      .status(200)
      .json({ success: true, message: "Subscription created succesfully." });
  } catch (error) {
    console.log("error - ", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

module.exports = router;
