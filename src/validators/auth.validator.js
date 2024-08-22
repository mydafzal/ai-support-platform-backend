const { z } = require("zod");

const loginSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z
    .string()
    .min(4, "Password must contain at least 4 characters.")
    .optional(),
  externalType: z.enum(["Google", "Apple", ""]),
  profileImageUrl: z.string().optional(),
});

const emailSchema = z.object({
  email: z.string().email(),
});

const passwordSchema = z.object({
  password: z.string().min(4),
});

module.exports = {
  loginSchema,
  emailSchema,
  passwordSchema,
};
