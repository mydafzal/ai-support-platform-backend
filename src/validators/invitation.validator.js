const { z } = require("zod");

const addInvitationSchema = z.object({
  email: z.string().email(),
  groupid: z.number().optional(),
  businessId: z.number(),
});

module.exports = { addInvitationSchema };
