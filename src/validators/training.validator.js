const { z } = require("zod");

const addUrlsSchema = z.object({
  urls: z.array(z.string().url("urls must be array with at least item")),
  businessId: z.number("businessId is required and must be a number"),
});

const addDocumentsSchema = z.object({
  files: z.array(z.string().url("files must be array with at least item")),
  businessId: z.number("businessId is required and must be a number"),
});

const teachChatSchema = z.object({
  message: z.string("message is required"),
  businessId: z.number("businessId is required and must be a number"),
});

module.exports = {
  addUrlsSchema,
  addDocumentsSchema,
  teachChatSchema,
};
