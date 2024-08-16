const {
  Feature,
  Subscription,
  PricingPlan,
  BusinessFeature,
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
  const { userId, businessId } = data;

  if (!userId) {
    throw { statusCode: 400, message: "userId is required" };
  }

  if (!businessId) {
    throw { statusCode: 400, message: "businessId is required" };
  }

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

  let businessFeatures = await BusinessFeature.findAll({
    where: {
      businessId,
    },
    raw: true,
  });

  if (businessFeatures.length < 1) {
    throw { statusCode: 404, message: "Invalid business id" };
  }

  pricingPlans = pricingPlans.map((planData) => {
    if (planData.isCurrentPlan) {
      planData.features.forEach((feature) => {
        const subscriptionFeature = businessFeatures?.find(
          (sf) => sf.featureId === feature.id
        );

        feature.baseQuantity = subscriptionFeature.quantity;
      });
    }

    delete planData.subscriptions;

    if (planData.basePlan) {
      let firstBasePlan = pricingPlans.find(
        (plan) => plan.id == planData.basePlan.id
      );

      let secondBasePlan = pricingPlans.find(
        (plan) => plan.id == firstBasePlan.basePlan?.id
      );

      // Remove features from this plan that are also included in its base plan.
      planData.features = planData.features.filter((feature) => {
        let existsInBasePlan;

        existsInBasePlan = firstBasePlan.features.some(
          (item) =>
            item.id === feature.id && item.baseQuantity === feature.baseQuantity
        );

        if (existsInBasePlan) {
          return false;
        }

        if (secondBasePlan) {
          existsInBasePlan = secondBasePlan.features.some(
            (item) =>
              item.id === feature.id &&
              item.baseQuantity === feature.baseQuantity
          );

          if (existsInBasePlan) {
            return false;
          }
        }

        return true;
      });
    }

    return planData;
  });

  return pricingPlans;
}

const PricingPlanService = { getFeaturesOfPlan, getPricingPlans };

module.exports = PricingPlanService;
