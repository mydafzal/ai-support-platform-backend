const router = require("express").Router();
const { Sequelize } = require("sequelize");
const CallTag = require("../models/callTag.model");

const { z } = require("zod");
const Call = require("../models/call.model");

const callTagValidationSchema = z.object({
  name: z.string(),
  userId: z.number(),
});

router.post("/", async (req, res) => {
  try {
    const { success, error } = await callTagValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name, userId } = req.body;

    let callTag = await CallTag.create({ name, userId });

    res.status(200).json({ success: true, data: callTag });
  } catch (error) {
    console.error("Error creating call group:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const callsToDelete = await Call.findAll({
      include: [
        {
          model: CallTag,
          where: { id: req.params.id },
          through: { attributes: [] }, // Exclude join table attributes
        },
      ],
      having: Sequelize.literal("COUNT(*) = 1"), // Only calls in this group
      group: ["Call.id", "CallTags.id"], // Group by call ID and call group ID
    });

    await CallTag.destroy({
      where: {
        id: req.params.id,
      },
    });

    await Promise.all(callsToDelete.map((call) => call.destroy()));

    res.status(204).json({ success: true });
  } catch (error) {
    console.error("Error deleting call tag:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
