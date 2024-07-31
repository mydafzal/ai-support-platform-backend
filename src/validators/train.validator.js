const { z } = require("zod");

const addUrlsSchema = z.object({
  urls: z.array(z.string().url()).min(1),
  businessId: z.number(),
});

const addDocumentsSchema = z.object({
  businessId: z.coerce.number(),
});

const teachChatSchema = z.object({
  message: z.string(),
  businessId: z.number(),
});

module.exports = {
  addUrlsSchema,
  addDocumentsSchema,
  teachChatSchema,
};
