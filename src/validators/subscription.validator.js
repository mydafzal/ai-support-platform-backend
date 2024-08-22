const { z } = require("zod");

const customizedFeatureSchema = z.object({
  featureId: z.number(),
  quantity: z.number(),
});

const createSubscriptionSchema = z.object({
  userId: z.number(),
  planId: z.number(),
  billingCycle: z.enum(["monthly", "yearly"]),
  customizedFeatures: z.array(customizedFeatureSchema).optional(),
});

const updateSubscriptionSchema = z.object({
  newPlanId: z.number().optional(),
  billingCycle: z.enum(["monthly", "yearly"]),
  customizedFeatures: z.array(customizedFeatureSchema).optional(),
});

module.exports = {
  createSubscriptionSchema,
  updateSubscriptionSchema,
};
