const { Op } = require("sequelize");
const {
  PricingPlan,
  Subscription,
  SubscriptionFeature,
  BusinessFeature,
  Business,
  PlanFeature,
  User,
  Feature,
  Invitation,
  BusinessMembership,
} = require("../../models");

const { FREE_PLAN_ID, TEAM_MEMBERS_FEATURE_ID } = require("../utils/constants");
const {
  calculateYearlyPrice,
  capitalizeFirstLetterOfEachWord,
  getNextMonthlyResetDate,
} = require("../utils/helpers");

const StripeService = require("./stripe.service");
const { getFeaturesOfPlan } = require("./pricing-plan.service");

async function createSubscription(data) {
  const { userId, planId, billingCycle, customizedFeatures = [] } = data;

  let user = await User.findByPk(userId, {
    raw: true,
  });

  if (!user) {
    throw { statusCode: 404, message: "Invalid user id." };
  }

  let pricingPlan = await PricingPlan.findByPk(planId, { raw: true });

  if (!pricingPlan) {
    throw { statusCode: 404, message: "Invalid pricing plan id." };
  }

  let method;

  if (user.stripeCustomerId) {
    method = await StripeService.getCustomerPaymentMethod(
      user.stripeCustomerId
    );
  }

  if (planId == FREE_PLAN_ID) {
    const customer = await StripeService.createStripeCustomer(user.email);

    await User.update(
      {
        stripeCustomerId: customer.id,
      },
      {
        where: {
          id: userId,
        },
      }
    );

    user.stripeCustomerId = customer.id;
  }

  // For plans other than free, a payment method is required.
  else if (!method) {
    throw { statusCode: 400, message: "Please add a payment method first." };
  }

  let basePrice;

  if (pricingPlan.name.toLowerCase() === "free") basePrice = 0;
  else basePrice = pricingPlan.monthlyBasePrice;

  let totalCost = parseFloat(basePrice);

  if (customizedFeatures.length > 0) {
    const features = await getFeaturesOfPlan(planId);

    const extraCost = calculateExtraCostBasedOnCustomizedFeatures(
      features,
      customizedFeatures
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
    user.stripeCustomerId,
    pricingPlan.stripeProductId,
    billingCycle,
    totalCostInCents,
    method
  );

  await Subscription.create(
    {
      stripeSubscriptionId: stripeSubscription.id,
      planId: pricingPlan.id,
      userId: user.id,
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

  const businessMemberhsip = await BusinessMembership.findOne({
    where: {
      userId: user.id,
      role: "Admin",
    },
    raw: true,
  });

  features = features.map((item) => {
    const customFeature = customizedFeatures.find(
      (f) => f.featureId === item.featureId
    );

    return {
      businessId: businessMemberhsip.businessId,
      featureId: item.featureId,
      quantity: customFeature ? customFeature.quantity : item.baseQuantity,
      usedQuantity: item.featureId == TEAM_MEMBERS_FEATURE_ID ? 1 : 0,
    };
  });

  await BusinessFeature.bulkCreate(features);

  return "Subscription created succesfully.";
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
          model: User,
          as: "user",
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

    const isDowngradingSubscription =
      hasPlanChanged && newPlanId < subscription.planId;

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

    const paymentMethod = await StripeService.getCustomerPaymentMethod(
      subscription.user.stripeCustomerId
    );

    if (pricingPlan != FREE_PLAN_ID && !paymentMethod) {
      throw {
        statusCode: 404,
        message: "Please add a payment method first.",
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

    const updatedStripeSubscription =
      await StripeService.updateStripeSubscriptionPrice(
        subscription.stripeSubscriptionId,
        newSubscriptionPrice.id,
        subscriptionItem.id,
        paymentMethod.id
      );

    // If payment failed while updating the subscription
    if (updatedStripeSubscription.pending_update) {
      // Revert changes to the subscription.
      await StripeService.voidInvoice(updatedStripeSubscription.latest_invoice);

      throw {
        statusCode: 400,
        message: "Payment failed while updating the subscription",
      };
    } else {
      const customer = await StripeService.getStripeCustomer(
        subscription.user.stripeCustomerId
      );

      if (customer.balance < 0) {
        await StripeService.refundCreditBalanceToCustomer(
          subscription.user.stripeCustomerId,
          subscription.stripeSubscriptionId
        );
      }
    }

    // Get all companies for which this user is the admin:
    const businessMemberships = await BusinessMembership.findAll({
      where: {
        userId: subscription.userId,
        role: "Admin",
      },
      raw: true,
    });

    const businessIds = businessMemberships.map((item) => item.businessId);

    let promises;

    // If subscription plan has changed:
    if (newPlanId) {
      // 1. Update subscription plan.
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

      // 2: Remove features from user's subscription that are not included in the new plan.
      await BusinessFeature.destroy({
        where: {
          businessId: {
            [Op.in]: businessIds,
          },
          featureId: {
            [Op.notIn]: newPlanFeatures.map((item) => item.id),
          },
        },
      });

      // 3: Add features to user's subscription that are not currently in the subscription but are included in the new plan:

      const currentFeatures = await PlanFeature.findAll({
        where: {
          planId: subscription.planId,
        },
        attributes: ["featureId"],
        raw: true,
      });

      const currentFeatureIds = new Set(
        currentFeatures.map((item) => item.featureId)
      );

      let newPlanFeaturesNotInCurrentSubscription = newPlanFeatures.filter(
        (feature) => !currentFeatureIds.has(feature.id)
      );

      promises = businessIds.map((businessId) => {
        newPlanFeaturesNotInCurrentSubscription =
          newPlanFeaturesNotInCurrentSubscription.map((item) => ({
            featureId: item.id,
            // subscriptionId: subscription.id,
            businessId,
            quantity: item.baseQuantity,
          }));

        return BusinessFeature.bulkCreate(
          newPlanFeaturesNotInCurrentSubscription
        );
      });

      await Promise.all(promises);
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

    promises = allFeatures.map((feature) =>
      BusinessFeature.update(
        { quantity: feature.quantity },
        {
          where: {
            featureId: feature.featureId,
            businessId: {
              [Op.in]: businessIds,
            },
          },
        }
      )
    );

    await Promise.all(promises);

    if (isDowngradingSubscription) {
      await removeExtraTeamMembers(subscription.userId);
    }

    return "Subscription updated succesfully.";
  } catch (error) {
    console.log("update subscription error - ", error);
    throw error;
  }
}

async function cancelSubscription(data) {
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
}

async function resumeSubscription(data) {
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
}

async function handleSubscriptionCancellation(
  cancelledSubscriptionId,
  customerId
) {
  const pricingPlan = await PricingPlan.findByPk(FREE_PLAN_ID, {
    raw: true,
  });

  const user = await User.findOne({
    where: {
      stripeCustomerId: customerId,
    },
    attributes: ["id", "stripeCustomerId"],
    raw: true,
  });

  const totalCostInCents = Math.round(
    parseFloat(pricingPlan.monthlyBasePrice) * 100
  );

  const method = await StripeService.getCustomerPaymentMethod(
    user.stripeCustomerId
  );

  const stripeSubscription = await StripeService.createStripeSubscription(
    user.stripeCustomerId,
    pricingPlan.stripeProductId,
    "monthly",
    totalCostInCents,
    method
  );

  const subscription = await Subscription.create(
    {
      stripeSubscriptionId: stripeSubscription.id,
      planId: pricingPlan.id,
      userId: user.id,
    },
    {
      raw: true,
    }
  );

  let features = await PlanFeature.findAll({
    where: {
      planId: pricingPlan.id,
    },
    raw: true,
  });

  // features = features.map((item) => ({
  //   subscriptionId: subscription.id,
  //   featureId: item.featureId,
  //   quantity: item.baseQuantity,
  //   usedQuantity: 0,
  // }));

  // Get all companies for which this user is the admin:
  const businesses = await BusinessMembership.findAll({
    where: {
      userId: subscription.userId,
      role: "Admin",
    },
    raw: true,
  });

  await BusinessFeature.destroy({
    where: {
      businessId: {
        [Op.in]: businesses.map((item) => item.businessId),
      },
    },
    raw: true,
  });

  businesses.map(({ businessId }) => {
    features = features.map((item) => ({
      businessId,
      featureId: item.featureId,
      quantity: item.baseQuantity,
      usedQuantity: 0,
    }));

    return BusinessFeature.bulkCreate(features);
  });

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

  if (
    !subscriptionFeature.quantity ||
    subscriptionFeature.quantity === "Unlimited"
  ) {
    return false;
  } else if (
    parseInt(subscriptionFeature.quantity) - subscriptionFeature.usedQuantity <
    1
  ) {
    return true;
  } else {
    return false;
  }
}

async function resetSubscriptionUsage(subscriptionId) {
  console.log(
    `Reached the end of billing cycle - resetting features usage now...`
  );

  try {
    let subscriptionFeatures = await SubscriptionFeature.findAll({
      where: {
        id: subscriptionId,
      },
      include: [
        {
          model: Feature,
          as: "feature",
        },
      ],
      raw: true,
      nest: true,
    });

    // get features that have a certain limit. certain features have limit but their usage should not reset.
    subscriptionFeatures = subscriptionFeatures.filter(
      (sf) =>
        sf.quantity &&
        sf.quantity !== "Unlimited" &&
        sf.feature.nameSingular.includes("month")
    );

    // reset usage for these features
    await Promise.all(
      subscriptionFeatures.map((sf) => {
        return SubscriptionFeature.update(
          {
            usedQuantity: 0,
          },
          {
            where: {
              subscriptionId,
              featureId: sf.feature.id,
            },
          }
        );
      })
    );
  } catch (error) {
    console.log("resetSubscriptionUsage error - ", error);
  }
}

async function scheduleResetForSubscriptionUsage() {
  try {
    let subscriptions = await Subscription.findAll({ raw: true });

    const today = new Date();

    const currentDate = today.getDate();
    const endOfCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    ).getDate();

    subscriptions.forEach(async (subscription) => {
      const stripeSubscription = await StripeService.getStripeSubscription(
        subscription.stripeSubscriptionId
      );

      const billingAnchorDate = new Date(
        stripeSubscription.billing_cycle_anchor * 1000
      ).getDate(); // Convert from Unix timestamp

      const isResetDay = currentDate === billingAnchorDate;

      const isEndOfMonthReset =
        billingAnchorDate > endOfCurrentMonth &&
        currentDate === endOfCurrentMonth;

      if (isResetDay || isEndOfMonthReset) {
        await resetSubscriptionUsage(subscription.id);
      }
    });
  } catch (error) {
    console.log("scheduleResetForSubscriptionUsage error - ", error);
  }
}

async function removeExtraTeamMembers(userId) {
  const businesses = await BusinessMembership.findAll({
    where: {
      userId,
    },
    attributes: ["businessId"],
    raw: true,
  });

  const businessIds = businesses.map((item) => item.businessId);

  const subscriptionFeature = await BusinessFeature.findOne({
    where: {
      businessId: {
        [Op.in]: businessIds,
      },
      featureId: TEAM_MEMBERS_FEATURE_ID,
    },
    raw: true,
  });

  const newMemberLimit = parseInt(subscriptionFeature.quantity);

  const memberships = await BusinessMembership.findAll({
    where: {
      businessId: {
        [Op.in]: businessIds,
      },
    },
    raw: true,
  });

  const membershipsToRemove = memberships
    .filter((member) => member.role !== "Admin")
    .sort((a, b) => a.createdAt - b.createdAt) // Sort users by creation date
    .slice(
      0,
      Math.max(0, memberships.length - newMemberLimit * businessIds.length)
    ); // Determine users to remove

  await BusinessMembership.destroy({
    where: {
      userId: {
        [Op.in]: membershipsToRemove.map((item) => item.userId),
      },
      businessId: {
        [Op.in]: businessIds,
      },
    },
  });
}

async function getSubscriptionDetails(data) {
  const { userId, businessId } = data;

  if (!userId) {
    throw { statusCode: 400, message: "userId is required" };
  }

  if (!businessId) {
    throw { statusCode: 400, message: "businessId is required" };
  }

  let subscription = await Subscription.findOne({
    where: {
      userId,
    },
    include: [
      {
        model: PricingPlan,
        as: "plan",
        attributes: {
          exclude: ["stripeProductId", "basePlanId"],
        },
      },
      {
        model: User,
        as: "user",
        attributes: {
          include: ["stripeCustomerId"],
        },
      },
    ],
    attributes: {
      exclude: ["planId"],
    },
    raw: true,
    nest: true,
  });

  if (!subscription) {
    throw { statusCode: 404, message: "Subscription not found" };
  }

  const businsessFeatures = await BusinessFeature.findAll({
    where: {
      businessId,
    },
    include: [
      {
        model: Feature,
        as: "feature",
      },
    ],
    raw: true,
    nest: true,
  });

  console.log("subscription - ", subscription);

  subscription.subscriptionFeatures = businsessFeatures.map((item) => {
    const featureName = item.feature.namePlural || item.feature.nameSingular;
    item.featureName = capitalizeFirstLetterOfEachWord(featureName);

    delete item.feature;
    return item;
  });

  const stripeSubscription = await StripeService.getStripeSubscription(
    subscription.stripeSubscriptionId
  );

  const formattedDate = getNextMonthlyResetDate(
    stripeSubscription.billing_cycle_anchor
  );

  delete subscription.user;

  subscription = {
    ...subscription,
    usageResetDate: formattedDate,
    status: stripeSubscription.status,
    startDate: stripeSubscription.start_date,
    price: stripeSubscription.items.data[0].price.unit_amount / 100, // convert from cents to dollars
    isScheduledForCancellation: stripeSubscription.cancel_at_period_end,
    currentPeriodEnd: stripeSubscription.current_period_end,
    billingCycle:
      stripeSubscription.items.data[0].price.recurring.interval === "month"
        ? "monthly"
        : "yearly",
  };

  return subscription;
}

const SubscriptionService = {
  handleSubscriptionCancellation,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  resumeSubscription,
  updateFeatureUsage,
  hasReachedFeatureLimit,
  scheduleResetForSubscriptionUsage,
  getSubscriptionDetails,
};

module.exports = SubscriptionService;
