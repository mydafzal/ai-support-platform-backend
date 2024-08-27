const {
  Feature,
  Subscription,
  PricingPlan,
  SubscriptionFeature,
} = require("../../models");

const { Sequelize } = require("sequelize");

async function getFeaturesOfPlan(planId) {
  return await Feature.findAll({
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
    raw: true,
    nest: true,
  });
}

async function getPricingPlans(data) {
  const { userId } = data;

  let pricingPlans = await PricingPlan.findAll({
    include: [
      {
        model: PricingPlan,
        as: "basePlan",
        attributes: ["id", "name"],
      },
      {
        model: Feature,
        as: "features",
        through: {
          attributes: [],
        },
      },
      {
        model: Subscription,
        as: "subscriptions",
        where: {
          userId,
        },
        required: false,
        include: [
          {
            model: SubscriptionFeature,
            as: "subscriptionFeatures",
            attributes: ["featureId", "quantity"],
          },
        ],
        attributes: ["id", "planId"],
      },
    ],
    attributes: {
      include: [
        [
          Sequelize.literal(
            `CASE WHEN "subscriptions"."planId" IS NOT NULL THEN true ELSE false END`
          ),
          "isCurrentPlan",
        ],
        [
          Sequelize.col("features.PlanFeature.baseQuantity"),
          "features.baseQuantity",
        ],
        [Sequelize.col("features.id"), "features.id"],
        [Sequelize.col("features.nameSingular"), "features.nameSingular"],
        [Sequelize.col("features.namePlural"), "features.namePlural"],
        [Sequelize.col("features.unitPrice"), "features.unitPrice"],
        [Sequelize.col("features.createdAt"), "features.createdAt"],
        [Sequelize.col("features.updatedAt"), "features.updatedAt"],
      ],
      exclude: ["basePlanId"],
    },
    order: [
      ["id", "ASC"],
      ["features.id", "ASC"],
    ],
  });

  pricingPlans = pricingPlans.map((item) => item.toJSON());

  return pricingPlans.map((planData) => {
    if (planData.isCurrentPlan) {
      const subscription = planData.subscriptions?.[0];

      planData.features.forEach((feature) => {
        const subscriptionFeature = subscription?.subscriptionFeatures.find(
          (sf) => sf.featureId === feature.id
        );

        feature.baseQuantity = subscriptionFeature.quantity;
      });
    }

    delete planData.subscriptions;

    if (planData.basePlan) {
      let basePlanFeatures = pricingPlans.find(
        (plan) => plan.id == planData.basePlan.id
      ).features;

      // Remove features from this plan that are also included in its base plan.
      planData.features = planData.features.filter((feature) => {
        const existsInBasePlan = basePlanFeatures.some(
          (item) =>
            item.id === feature.id && item.baseQuantity === feature.baseQuantity
        );

        return !existsInBasePlan;
      });
    }

    return planData;
  });
}

const PricingPlanService = { getFeaturesOfPlan, getPricingPlans };

module.exports = PricingPlanService;
