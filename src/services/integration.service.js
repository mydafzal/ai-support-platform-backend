const { Sequelize } = require("sequelize");
const { Integration, BusinessIntegration } = require("../../models");

async function getIntegrationsByBusiness(data) {
  const { businessId, recommended } = data;

  let whereCondition = {};
  if (recommended == "true") {
    whereCondition.recommended = true;
  }

  return await Integration.findAll({
    where: whereCondition,
    include: [
      {
        model: BusinessIntegration,
        as: "integration",
        where: { businessId },
        attributes: [],
        required: false,
      },
    ],
    attributes: {
      include: [
        [
          Sequelize.literal(
            'CASE WHEN "integration"."businessId" IS NOT NULL THEN true ELSE false END'
          ),
          "connected",
        ],
        [Sequelize.col("integration.id"), "businessIntegrationId"],
      ],
    },
    raw: true,
    nest: true,
  });
}

const IntegrationService = {
  getIntegrationsByBusiness,
};

module.exports = IntegrationService;
