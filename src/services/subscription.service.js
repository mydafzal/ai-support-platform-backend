const { Op } = require("sequelize");
const {
  PricingPlan,
  Subscription,
  SubscriptionFeature,
  Business,
  PlanFeature,
} = require("../../models");

const { FREE_PLAN_ID } = require("../utils/constants");
const { calculateYearlyPrice } = require("../utils/helpers");

const StripeService = require("./stripe.service");
const { getFeaturesOfPlan } = require("./pricingPlan.service");

async function createSubscription(data) {
  try {
    const { businessId, planId, billingCycle, customizedFeatures = [] } = data;

    let business = await Business.findByPk(businessId, { raw: true });

    if (!business) throw new Error("Invalid business id.");

    let pricingPlan = await PricingPlan.findByPk(planId, { raw: true });

    if (!pricingPlan) throw new Error("Invalid pricing plan id.");

    if (!business.stripeCustomerId)
      throw new Error("Please add a payment method first.");

    const method = await StripeService.getCustomerPaymentMethod(
      business.stripeCustomerId
    );

    if (!method) throw new Error("Please add a payment method first.");

    let basePrice;

    if (pricingPlan.name.toLowerCase() === "free") basePrice = 0;
    else basePrice = pricingPlan.monthlyBasePrice;

    let totalCost = parseFloat(basePrice);

    const customizedFeatureIds = customizedFeatures.map(
      (feature) => feature.featureId
    );

    if (customizedFeatures.length > 0) {
      const features = await getFeaturesOfPlan(planId);

      const extraCost = calculateExtraCostBasedOnCustomizedFeatures(
        features,
        customizedFeatureIds
      );

      totalCost += extraCost;
    }

    if (billingCycle === "yearly") {
      totalCost = calculateYearlyPrice(
        totalCost,
        pricingPlan.yearlyDiscountPercentage
      );
    }

    const totalCostInCents = Math.round(totalCost * 100);

    const stripeSubscription = await StripeService.createStripeSubscription(
      business.stripeCustomerId,
      pricingPlan.stripeProductId,
      billingCycle,
      totalCostInCents
    );

    const subscription = await Subscription.create(
      {
        stripeSubscriptionId: stripeSubscription.id,
        planId: pricingPlan.id,
        businessId: business.id,
      },
      {
        raw: true,
      }
    );

    let whereCondition = {
      planId,
    };

    if (customizedFeatures.length > 0) {
      whereCondition.featureId = {
        [Op.notIn]: customizedFeatureIds,
      };
    }

    let features = await PlanFeature.findAll({
      where: whereCondition,
      raw: true,
    });

    features = features.map((item) => {
      const customFeature = customizedFeatures.find(
        (f) => f.featureId === item.featureId
      );

      return {
        subscriptionId: subscription.id,
        featureId: item.featureId,
        quantity: customFeature ? customFeature.quantity : item.baseQuantity,
        usedQuantity: 0,
      };
    });

    await SubscriptionFeature.bulkCreate(features);

    return "Subscription created succesfully.";
  } catch (error) {
    console.log("create subscription error - ", error);
    throw error;
  }
}

async function handleSubscriptionCancellation(
  cancelledSubscriptionId,
  customerId
) {
  const pricingPlan = await PricingPlan.findByPk(FREE_PLAN_ID, {
    raw: true,
  });

  const business = await Business.findByPk(customerId, {
    attributes: ["id", "stripeCustomerId"],
    raw: true,
  });

  const totalCostInCents = Math.round(
    parseFloat(pricingPlan.monthlyBasePrice) * 100
  );

  const stripeSubscription = await StripeService.createStripeSubscription(
    business.stripeCustomerId,
    pricingPlan.stripeProductId,
    totalCostInCents
  );

  const subscription = await Subscription.create(
    {
      stripeSubscriptionId: stripeSubscription.id,
      planId: pricingPlan.id,
      businessId: business.id,
    },
    {
      raw: true,
    }
  );

  let features = await PlanFeature.findAll({
    where: {
      planId,
    },
    raw: true,
  });

  features = features.map((item) => ({
    subscriptionId: subscription.id,
    featureId: item.featureId,
    quantity: item.baseQuantity,
    usedQuantity: 0,
  }));

  await SubscriptionFeature.bulkCreate(features);

  await Subscription.destroy({
    where: {
      stripeSubscriptionId: cancelledSubscriptionId,
    },
  });
}

function calculateExtraCostBasedOnCustomizedFeatures(
  allFeatures,
  customizedFeatures
) {
  let totalExtraCost = 0;

  allFeatures.forEach((feature) => {
    const customizedFeature = customizedFeatures.find(
      (item) => item.featureId == feature.id
    );

    if (customizedFeature) {
      const extraUnits =
        customizedFeature.quantity - parseInt(feature.baseQuantity);

      const featureExtraCost =
        parseFloat(feature.unitPrice) * parseInt(extraUnits);

      totalExtraCost += featureExtraCost;
    }
  });

  return totalExtraCost;
}

const SubscriptionService = {
  handleSubscriptionCancellation,
  createSubscription,
};

module.exports = SubscriptionService;
