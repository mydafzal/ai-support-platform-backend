const router = require("express").Router();
const User = require("../models/user.model");

const { z } = require("zod");
const TeamMember = require("../models/teamMember.model");

const addTeamMemberValidationSchema = z.object({
  name: z.string(),
  phoneNumber: z.string(),
  teamGroupId: z.number(),
  userId: z.number(),
});

const updateTeamMemberValidationSchema = z.object({
  name: z.string(),
  phoneNumber: z.string(),
  teamGroupId: z.number(),
});

router.post("/", async (req, res) => {
  try {
    const { success, error } =
      await addTeamMemberValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name, phoneNumber, userId, teamGroupId } = req.body;

    let teamMember = await TeamMember.create({
      name,
      phoneNumber,
      userId,
      teamGroupId,
    });

    res.status(201).json({ success: true, data: teamMember.toJSON() });
  } catch (error) {
    console.error("Error adding teamMember:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await TeamMember.destroy({
      where: {
        id: req.params.id,
      },
    });

    res.status(204);
  } catch (error) {
    console.error("Error deleting team member: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  const teamMemberId = req.params.id;

  try {
    const { success, error } =
      await updateTeamMemberValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name, phoneNumber, teamGroupId } = req.body;

    await TeamMember.update(
      {
        name,
        phoneNumber,
        teamGroupId,
      },
      {
        where: {
          id: teamMemberId,
        },
      }
    );

    res.status(200).json({ success: true, message: "Team member updated." });
  } catch (error) {
    console.error("Error updating team member: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
