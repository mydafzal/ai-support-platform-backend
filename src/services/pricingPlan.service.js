const { Sequelize } = require("sequelize");
const { Feature, PricingPlan } = require("../../models");

async function getFeaturesOfPlan(planId) {
  return await Feature.findAll({
    // where: {
    //   id: {
    //     [Op.in]: customizedFeatureIds,
    //   },
    // },
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
  });
}

const PricingPlanService = { getFeaturesOfPlan };

module.exports = PricingPlanService;
