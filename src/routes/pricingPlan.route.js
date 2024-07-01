const Router = require("express").Router;
const router = Router();

const { Sequelize } = require("sequelize");
const { PricingPlan, Feature } = require("../../models");

router.get("/", async (req, res) => {
  try {
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
      ],
      attributes: {
        include: [
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
    });

    pricingPlans = pricingPlans.map((item) => item.toJSON());

    return res.status(200).json({ success: true, data: pricingPlans });
  } catch (error) {
    console.error("Error getting pricing plans - ", error);
    res.status(500).json({ success: false, message: "Internal Server Error." });
  }
});

module.exports = router;
