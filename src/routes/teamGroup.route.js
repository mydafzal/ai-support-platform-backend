const router = require("express").Router();
const User = require("../../models");

const { z } = require("zod");
const TeamGroup = require("../../models");
const TeamMember = require("../../models");
const { Op } = require("sequelize");

const addTeamGroupValidationSchema = z.object({
  name: z.string(),
  userId: z.number(),
});

const updateTeamGroupValidationSchema = z.object({
  name: z.string(),
});

const assignGroupToMembersValidationSchema = z.object({
  teamMemberIds: z.array(z.number()),
});

router.post("/", async (req, res) => {
  try {
    const { success, error } =
      await addTeamGroupValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name, userId } = req.body;

    let teamGroup = await TeamGroup.create({
      name,
      userId,
    });

    res.status(201).json({ success: true, data: teamGroup.toJSON() });
  } catch (error) {
    console.error("Error adding teamGroup:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id/team-members", async (req, res) => {
  const teamGroupId = req.params.id;

  try {
    const { success, error } =
      await assignGroupToMembersValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { teamMemberIds } = req.body;

    const teamGroup = await TeamGroup.findByPk(teamGroupId);

    if (!teamGroup) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid group id." });
    }

    await TeamMember.update(
      { teamGroupId },
      {
        where: {
          id: {
            [Op.in]: teamMemberIds,
          },
        },
      }
    );
    res
      .status(200)
      .json({ success: true, message: "Updated group of team members." });
  } catch (error) {
    console.error("Error adding teamGroup:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await TeamGroup.destroy({
      where: {
        id: req.params.id,
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting team group: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/:id", async (req, res) => {
  const teamGroupId = req.params.id;

  try {
    const { success, error } =
      await updateTeamGroupValidationSchema.safeParseAsync(req.body);

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name } = req.body;

    await TeamGroup.update(
      {
        name,
      },
      {
        where: {
          id: teamGroupId,
        },
      }
    );

    res.status(200).json({ success: true, message: "Team group updated." });
  } catch (error) {
    console.error("Error updating team group: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
