const { z } = require("zod");

const addBusinessSchema = z.object({
  userId: z.number(),
  businessName: z.string(),
  assistantName: z.string(),
  voiceId: z.string(),
  voiceName: z.string(),
  greetingMessage: z.string(),
  farewellMessage: z.string(),
});

const updateBusinessSchema = z.object({
  businessName: z.string().optional(),
  assistantName: z.string().optional(),
  voiceId: z.string().optional(),
  voiceName: z.string().optional(),
  greetingMessage: z.string().optional(),
  farewellMessage: z.string().optional(),
});

module.exports = { addBusinessSchema, updateBusinessSchema };
