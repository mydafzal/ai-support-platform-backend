const { z } = require("zod");

const addCallTagSchema = z.object({
  name: z.string(),
  businessId: z.number(),
});

const callTaggingSchema = z.object({
  callIds: z.array(z.string()),
});

module.exports = {
  addCallTagSchema,
  callTaggingSchema,
};
