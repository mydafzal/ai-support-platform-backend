const { Op } = require("sequelize");
const {
  PricingPlan,
  Subscription,
  SubscriptionFeature,
  Business,
  PlanFeature,
  User,
  Feature,
  Invitation,
} = require("../../models");

const { FREE_PLAN_ID, TEAM_MEMBERS_FEATURE_ID } = require("../utils/constants");
const { calculateYearlyPrice } = require("../utils/helpers");

const StripeService = require("./stripe.service");
const { getFeaturesOfPlan } = require("./pricingPlan.service");

async function createSubscription(data) {
  try {
    const { businessId, planId, billingCycle, customizedFeatures = [] } = data;

    let business = await Business.findByPk(businessId, {
      include: [
        {
          model: User,
          as: "adminUser",
          attributes: ["email"],
        },
      ],
      raw: true,
      nest: true,
    });

    if (!business) {
      throw { statusCode: 404, message: "Invalid business id." };
    }

    let pricingPlan = await PricingPlan.findByPk(planId, { raw: true });

    if (!pricingPlan) {
      throw { statusCode: 404, message: "Invalid pricing plan id." };
    }

    let method;

    if (business.stripeCustomerId) {
      method = await StripeService.getCustomerPaymentMethod(
        business.stripeCustomerId
      );
    }

    if (planId == FREE_PLAN_ID) {
      const customer = await StripeService.createStripeCustomer(
        business.adminUser.email
      );

      await Business.update(
        {
          stripeCustomerId: customer.id,
        },
        {
          where: {
            id: businessId,
          },
        }
      );

      business.stripeCustomerId = customer.id;
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
      business.stripeCustomerId,
      pricingPlan.stripeProductId,
      billingCycle,
      totalCostInCents,
      method
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
      subscription.business.stripeCustomerId
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
        subscription.business.stripeCustomerId
      );

      if (customer.balance < 0) {
        await StripeService.refundCreditBalanceToCustomer(
          subscription.business.stripeCustomerId,
          subscription.stripeSubscriptionId
        );
      }
    }

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
      await SubscriptionFeature.destroy({
        where: {
          subscriptionId: subscription.id,
          featureId: {
            [Op.notIn]: newPlanFeatures.map((item) => item.id),
          },
        },
      });

      // 3: Add features to user's subscription that are not currently in the subscription but are included in the new plan:
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

    if (isDowngradingSubscription) {
      await removeExtraTeamMembers(subscription.id, subscription.businessId);
    }

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

  const method = await StripeService.getCustomerPaymentMethod(
    business.stripeCustomerId
  );

  const stripeSubscription = await StripeService.createStripeSubscription(
    business.stripeCustomerId,
    pricingPlan.stripeProductId,
    "monthly",
    totalCostInCents,
    method
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

async function removeExtraTeamMembers(subscriptionId, businessId) {
  const subscriptionFeature = await SubscriptionFeature.findOne({
    where: {
      subscriptionId,
      featureId: TEAM_MEMBERS_FEATURE_ID,
    },
    raw: true,
  });

  const newMemberLimit = parseInt(subscriptionFeature.quantity);

  const users = await User.findAll({
    where: {
      businessId,
    },
    raw: true,
  });

  const membersToRemove = users
    .filter((user) => user.role !== "Admin") // Exclude admin
    .sort((a, b) => a.createdAt - b.createdAt) // Sort users by creation date
    .slice(0, Math.max(0, users.length - newMemberLimit)); // Determine users to remove

  for (const user of membersToRemove) {
    await User.update(
      {
        businessId: null,
      },
      {
        where: {
          id: user.id,
        },
      }
    );

    await Invitation.destroy({
      where: {
        email: user.email,
      },
    });
  }
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
};

module.exports = SubscriptionService;
