const { z } = require("zod");

const addBusinessSchema = z.object({
  userId: z.coerce.number(),
  businessName: z.string(),
  assistantName: z.string(),
  voiceId: z.string().optional(),
  voiceName: z.string(),
  greetingMessage: z.string(),
  farewellMessage: z.string(),
  file: z.any().optional(),
});

const updateBusinessSchema = z.object({
  businessName: z.string().optional(),
  assistantName: z.string().optional(),
  voiceId: z.string().optional(),
  voiceName: z.string().optional(),
  greetingMessage: z.string().optional(),
  farewellMessage: z.string().optional(),
  file: z.any().optional(),
});

const businessIdSchema = z.object({
  id: z.coerce.number(),
});

module.exports = { addBusinessSchema, updateBusinessSchema, businessIdSchema };
