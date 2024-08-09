const { z } = require("zod");

const updateChatAssignmentSchema = z.object({
  viewed: z.boolean(),
  userId: z.number(),
  chatIds: z.array(z.number()),
});

module.exports = {
  updateChatAssignmentSchema,
};
