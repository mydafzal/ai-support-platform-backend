const { Op } = require("sequelize");
const {
  PricingPlan,
  Subscription,
  SubscriptionFeature,
  Business,
  PlanFeature,
} = require("../../models");

const { FREE_PLAN_ID, TEAM_MEMBERS_FEATURE_ID } = require("../utils/constants");
const { calculateYearlyPrice } = require("../utils/helpers");

const StripeService = require("./stripe.service");
const { getFeaturesOfPlan } = require("./pricingPlan.service");

async function createSubscription(data) {
  try {
    const { businessId, planId, billingCycle, customizedFeatures = [] } = data;

    let business = await Business.findByPk(businessId, { raw: true });

    if (!business) {
      throw { statusCode: 404, message: "Invalid business id." };
    }

    let pricingPlan = await PricingPlan.findByPk(planId, { raw: true });

    if (!pricingPlan) {
      throw { statusCode: 404, message: "Invalid pricing plan id." };
    }

    if (!business.stripeCustomerId) {
      throw { statusCode: 400, message: "Please add a payment method first." };
    }

    const method = await StripeService.getCustomerPaymentMethod(
      business.stripeCustomerId
    );

    if (!method) {
      throw { statusCode: 400, message: "Please add a payment method first." };
    }

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
        usedQuantity: item.featureId == TEAM_MEMBERS_FEATURE_ID ? 1 : 0,
      };
    });

    await SubscriptionFeature.bulkCreate(features);

    return "Subscription created succesfully.";
  } catch (error) {
    console.log("create subscription error - ", error);
    throw error;
  }
}

async function updateSubscription(data) {
  try {
    const {
      subscriptionId,
      newPlanId,
      billingCycle,
      customizedFeatures = [],
    } = data;

    let subscription = await Subscription.findByPk(subscriptionId, {
      include: [
        {
          model: Business,
          as: "business",
        },
      ],
      raw: true,
      nest: true,
    });

    if (!subscription) {
      throw { statusCode: 404, message: "Invalid subscription id." };
    }

    const stripeSubscription = await StripeService.getStripeSubscription(
      subscription.stripeSubscriptionId
    );

    const subscriptionItem = stripeSubscription.items.data[0];
    const currentSubscriptionPrice = subscriptionItem.price;

    const currentBillingCycle =
      currentSubscriptionPrice.recurring.interval === "month"
        ? "monthly"
        : "yearly";

    // Check if the new subscription changes are the same as current subscription details:

    const hasPlanChanged = newPlanId != subscription.planId;

    if (
      !hasPlanChanged &&
      currentBillingCycle === billingCycle &&
      customizedFeatures.length < 1
    ) {
      throw {
        statusCode: 400,
        message: "No changes were identified in the subscrption.",
      };
    }

    let pricingPlan = await PricingPlan.findByPk(
      newPlanId || subscription.planId,
      {
        raw: true,
      }
    );

    if (!pricingPlan) {
      throw {
        statusCode: 404,
        message: "Invalid pricing plan id.",
      };
    }

    const basePrice = pricingPlan.monthlyBasePrice;
    let totalCost = parseFloat(basePrice);

    const newPlanFeatures = await getFeaturesOfPlan(
      newPlanId || subscription.planId,
      {
        raw: true,
      }
    );

    if (customizedFeatures.length > 0) {
      const totalExtraCost = calculateExtraCostBasedOnCustomizedFeatures(
        newPlanFeatures,
        customizedFeatures
      );

      totalCost += totalExtraCost;
    }

    if (billingCycle === "yearly") {
      totalCost = calculateYearlyPrice(
        totalCost,
        pricingPlan.yearlyDiscountPercentage
      );
    }

    const totalCostInCents = Math.round(totalCost * 100);

    const newSubscriptionPrice = await StripeService.createStripePrice(
      totalCostInCents,
      pricingPlan.stripeProductId,
      billingCycle
    );

    console.log("subscription - ", subscription);

    const paymentMethod = await StripeService.getCustomerPaymentMethod(
      subscription.business.stripeCustomerId
    );

    await StripeService.updateStripeSubscriptionPrice(
      subscription.stripeSubscriptionId,
      newSubscriptionPrice.id,
      subscriptionItem.id,
      paymentMethod.id
    );

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

    // If subscription plan has changed, then:
    if (newPlanId) {
      // 1: Remove features from user's subscription that are not included in the new plan.
      await SubscriptionFeature.destroy({
        where: {
          subscriptionId: subscription.id,
          featureId: {
            [Op.notIn]: newPlanFeatures.map((item) => item.id),
          },
        },
      });

      // 2: Add features to user's subscription that are not currently in the subscription but are included in the new plan:
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
    }

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

    return "Subscription updated succesfully.";
  } catch (error) {
    console.log("update subscription error - ", error);
    throw error;
  }
}

async function cancelSubscription(data) {
  try {
    const { subscriptionId } = data;

    let subscription = await Subscription.findByPk(subscriptionId, {
      raw: true,
    });

    if (!subscription) {
      throw { statusCode: 404, message: "Invalid subscription id." };
    }

    const stripeSubscription = await StripeService.cancelStripeSubscription(
      subscription.stripeSubscriptionId
    );

    const result = {
      isScheduledForCancellation: stripeSubscription.cancel_at_period_end,
      currentPeriodEnd: stripeSubscription.current_period_end,
    };

    return result;
  } catch (error) {
    console.log("cancel subscription error - ", error);
    throw error;
  }
}

async function resumeSubscription(data) {
  try {
    const { subscriptionId } = data;

    let subscription = await Subscription.findByPk(subscriptionId, {
      raw: true,
    });

    if (!subscription) {
      throw { statusCode: 404, message: "Invalid subscription id." };
    }

    const stripeSubscription = await StripeService.resumeStripeSubscription(
      subscription.stripeSubscriptionId
    );

    const result = {
      isScheduledForCancellation: stripeSubscription.cancel_at_period_end,
      currentPeriodEnd: stripeSubscription.current_period_end,
    };

    return result;
  } catch (error) {
    console.log("cancel subscription error - ", error);
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

async function updateFeatureUsage(featureId, businessId, additionalUsage) {
  const subscription = await Subscription.findOne({
    where: {
      businessId,
    },
    raw: true,
  });

  const subscriptionFeature = await SubscriptionFeature.findOne({
    where: {
      featureId,
      subscriptionId: subscription.id,
    },
  });

  if (additionalUsage >= 0) {
    // Increase usage
    subscriptionFeature.usedQuantity += additionalUsage;
  } else {
    // Decrease usage
    subscriptionFeature.usedQuantity = Math.max(
      0,
      subscriptionFeature.usedQuantity + additionalUsage
    );
  }

  await subscriptionFeature.save();
}

async function hasReachedFeatureLimit(featureId, businessId) {
  const subscription = await Subscription.findOne({
    where: {
      businessId,
    },
    raw: true,
  });

  const subscriptionFeature = await SubscriptionFeature.findOne({
    where: {
      featureId,
      subscriptionId: subscription.id,
    },
  });

  console.log(
    "parseInt(subscriptionFeature.quantity) - ",
    subscriptionFeature.quantity
  );

  console.log(
    "subscriptionFeature.usedQuantity - ",
    subscriptionFeature.usedQuantity
  );

  console.log(
    "result - ",
    parseInt(subscriptionFeature.quantity) - subscriptionFeature.usedQuantity
  );

  return (
    subscriptionFeature.quantity === "Unlimited" ||
    parseInt(subscriptionFeature.quantity) - subscriptionFeature.usedQuantity <
      1
  );
}

const SubscriptionService = {
  handleSubscriptionCancellation,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  resumeSubscription,
  updateFeatureUsage,
  hasReachedFeatureLimit,
};

module.exports = SubscriptionService;
