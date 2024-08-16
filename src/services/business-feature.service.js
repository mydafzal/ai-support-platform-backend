const { Op } = require("sequelize");
const { BusinessMembership, BusinessFeature } = require("../../models");

async function initalizeSubscriptionFeaturesofBusiness(userId, newBusinessId) {
  const business = await BusinessMembership.findOne({
    where: {
      userId,
      businessId: {
        [Op.ne]: newBusinessId,
      },
      role: "Admin",
    },
    raw: true,
  });

  const features = await BusinessFeature.findAll({
    where: {
      businessId: business.businessId,
    },
    attributes: ["featureId", "quantity"],
    raw: true,
  });

  const data = features.map((item) => ({
    ...item,
    businessId: newBusinessId,
    usedQuantity: 0,
  }));

  await BusinessFeature.bulkCreate(data);
}

const BusinessFeatureService = { initalizeSubscriptionFeaturesofBusiness };

module.exports = BusinessFeatureService;
