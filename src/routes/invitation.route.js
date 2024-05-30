const router = require("express").Router();
const { User, Invitation, Business } = require("../../models");

const jwt = require("jsonwebtoken");

const { z } = require("zod");

const { sendEmail } = require("../integrations/nodemailer");
const { generateEmailLink } = require("../utils/helpers");
const { Op } = require("sequelize");

const invitationValidationSchema = z.object({
  email: z.string().email(),
  teamGroupId: z.number().optional(),
  businessId: z.number(),
});

router.post("/", async (req, res) => {
  try {
    const { success, error } = await invitationValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { businessId, email, teamGroupId } = req.body;

    let user = await Invitation.findOne({
      where: {
        email,
      },
    });

    if (!user) {
      user = await User.findOne({
        where: {
          email,
          businessId: {
            [Op.not]: null,
          },
        },
      });
    }

    if (user) {
      return res.status(400).json({
        success: false,
        message:
          "Couldn't send invitation. User is already a member of a different organization.",
      });
    }

    let invitation = await Invitation.create({
      email,
      businessId,
      teamGroupId,
      status: "Pending",
    });

    invitation = invitation?.toJSON();

    const invitationToken = jwt.sign(
      { invitationId: invitation.id, email },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    await Invitation.update(
      {
        token: invitationToken,
      },
      { where: { id: invitation.id } }
    );

    let business = await Business.findByPk(businessId, {
      include: [
        {
          model: User,
          as: "adminUser",
        },
      ],
    });
    business = business.toJSON();

    const emailLink = generateEmailLink(
      req,
      "invites",
      `token=${invitationToken}`
    );
    const emailTemplate = `${business.adminUser.email} invited you to ${business.name}. Click <a href="${emailLink}">here</a> to accept the invitation.`;
    await sendEmail(email, emailTemplate);

    res.status(201).json({
      success: true,
      data: invitation,
      message: "Invitation sent.",
    });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/", async (req, res) => {
  try {
    const { token } = req.query;

    let decodedToken;

    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      console.log("Error verifying invitation token - ", error);
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token." });
    }

    if (!decodedToken || !decodedToken.invitationId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token." });
    }

    let invitation = await Invitation.findByPk(decodedToken.invitationId);

    if (!invitation) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token." });
    }

    if (invitation?.toJSON()?.status === "Accepted") {
      return res
        .status(200)
        .json({ success: true, message: "The invite was already accepted." });
    }

    invitation.token = null;
    invitation.status = "Accepted";
    await invitation.save();

    invitation = invitation.toJSON();

    let business = await Business.findByPk(invitation.businessId);
    business = business.toJSON();

    await User.update(
      {
        businessId: business.id,
      },
      {
        where: {
          email: invitation.email,
        },
      }
    );

    res.status(200).json({
      success: true,
      message: `You have been added to the organization ${business.name}.`,
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    let invitation = await Invitation.findByPk(req.params.id);

    if (!invitation) {
      return res.status(204).send();
    }

    await Invitation.destroy({
      where: {
        id: req.params.id,
      },
    });

    if (invitation) {
      invitation = invitation.toJSON();

      await User.update(
        {
          businessId: null,
        },
        {
          where: {
            email: invitation.email,
          },
        }
      );

      let business = await Business.findByPk(invitation.businessId);
      const { name } = business.toJSON();

      let user = await User.findByPk(business.toJSON().adminUserId);
      user = user.toJSON();

      let emailTemplate;

      if (invitation.status === "Pending") {
        emailTemplate = `Your invitation for organization ${name} has been cancelled.`;
      } else {
        emailTemplate = `${user.email} removed you from organization ${name}.`;
      }

      await sendEmail(invitation.email, emailTemplate);
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting invitation: ", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
