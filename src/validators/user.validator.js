const { z } = require("zod");

const addUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  name: z.string(),
});

const updateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  businessId: z.coerce.number().optional().or(z.coerce.string()),
});

const unviewedChatsSchema = z.object({
  viewed: z.coerce.boolean().optional(),
});

module.exports = { addUserSchema, updateUserSchema, unviewedChatsSchema };
