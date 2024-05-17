const router = require("express").Router();
const { CallTag, Call } = require("../../models");

const { z } = require("zod");

const addCallTagValidationSchema = z.object({
  name: z.string(),
  businessId: z.number(),
});

const callTaggingValidationSchema = z.object({
  callIds: z.array(z.string()),
});

router.post("/", async (req, res) => {
  try {
    const { success, error } = await addCallTagValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name, businessId } = req.body;

    let callTag = await CallTag.create({ name, businessId });

    res.status(200).json({ success: true, data: callTag });
  } catch (error) {
    console.error("Error creating call group:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  const callTagId = req.params.id;

  try {
    await CallTag.destroy({
      where: {
        id: callTagId,
      },
    });

    res.status(204).json({ success: true });
  } catch (error) {
    console.error("Error deleting call tag:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { success, error } = await callTaggingValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { callIds } = req.body;

    await Call.update(
      { callTagId: req.params.id },
      {
        where: {
          id: callIds,
        },
      }
    );

    res.status(200).json({ success: true, message: "Calls added to tag." });
  } catch (error) {
    console.error("Error tagging calls: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
