const { z } = require("zod");
const { parsePhoneNumberFromString } = require("libphonenumber-js");

const chatMessageSchema = z.object({
  message: z.string(),
});

const preChatFormSchema = z.object({
  businessId: z.number(),
  name: z.string(),
  email: z.string().email(),
  teamGroupName: z.string().optional(),
  teamGroupId: z.number().optional(),
  phone: z.string({}).transform((arg, ctx) => {
    const phone = parsePhoneNumberFromString(arg, {
      // set to false to require that the whole string is exactly a phone number
      extract: false,
    });

    if (phone && phone.isValid()) return phone.number;

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid phone number",
    });

    return z.NEVER;
  }),
});

const updateChatSchema = z.object({
  status: z.string().optional(),
  teamGroupIds: z.array(z.number()).optional(),
});

const chatFileUploadsSchema = z.object({
  userId: z.coerce.number().optional(),
});

module.exports = {
  chatMessageSchema,
  preChatFormSchema,
  updateChatSchema,
  chatFileUploadsSchema,
};
