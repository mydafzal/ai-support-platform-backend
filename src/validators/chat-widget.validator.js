const { z } = require("zod");

const createWidgetSchema = z.object({
  name: z.string(),
  welcomeMessage: z.string(),
  colorHexCode: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color code."),
  businessId: z.coerce.number(),
});

const updateWidgetSchema = z.object({
  name: z.string(),
  welcomeMessage: z.string(),
  colorHexCode: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid color code."),
});

module.exports = {
  createWidgetSchema,
  updateWidgetSchema,
};
