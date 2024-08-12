const router = require("express").Router();
const {
  User,
  Invitation,
  Business,
  BusinessMembership,
} = require("../../models");

const jwt = require("jsonwebtoken");

const { sendEmail } = require("../integrations/nodemailer");
const { generateEmailLink } = require("../utils/helpers");
const { Op } = require("sequelize");

const SubscriptionService = require("../services/subscription.service");
const { TEAM_MEMBERS_FEATURE_ID } = require("../utils/constants");

const validateRequest = require("../middleware/request-validation.middleware");
const { addInvitationSchema } = require("../validators/invitation.validator");
const asyncHandler = require("../utils/async-handler");
const ResponseHandler = require("../utils/response-handler");
const { emailSchema } = require("../validators/auth.validator");

router.post(
  "/",
  validateRequest(addInvitationSchema),
  asyncHandler(async (req, res) => {
    const { businessId, email, groupId } = req.body;

    const business = await Business.findOne({
      where: { id: businessId },
      include: [
        {
          model: User,
          as: "users",
          attributes: ["id", "name", "email"],
          through: {
            attributes: [],
            where: { role: "Admin" },
          },
        },
      ],
      raw: true,
      nest: true,
    });

    if (!business) {
      ResponseHandler.error(res, {
        statusCode: 404,
        message: "Invalid business id",
      });
    }

    // const hasReachedLimit = await SubscriptionService.hasReachedFeatureLimit(
    //   TEAM_MEMBERS_FEATURE_ID,
    //   businessId
    // );

    // if (hasReachedLimit) {
    //   ResponseHandler.error(res, {
    //     statusCode: 400,
    //     message: "Operation denied: Feature limit has been exceeded.",
    //   });
    // }

    let invitation = await Invitation.create({
      email,
      businessId,
      groupId,
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

    business.adminUser = business.users;
    delete business.users;

    const emailLink = generateEmailLink("invites", `token=${invitationToken}`);
    const emailTemplate = `${business.adminUser.email} invited you to ${business.name}. Click <a href="${emailLink}">here</a> to accept the invitation.`;
    await sendEmail(email, emailTemplate);

    // await SubscriptionService.updateFeatureUsage(
    //   TEAM_MEMBERS_FEATURE_ID,
    //   businessId,
    //   1
    // );

    ResponseHandler.success(res, {
      statusCode: 201,
      data: invitation,
      message: "Invitation sent.",
    });
  })
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const { token } = req.query;

    let decodedToken;

    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return ResponseHandler.error(res, {
        statusCode: 400,
        message: "Invalid or expired token.",
      });
    }

    if (!decodedToken || !decodedToken.invitationId) {
      return ResponseHandler.error(res, {
        statusCode: 400,
        message: "Invalid or expired token.",
      });
    }

    let invitation = await Invitation.findByPk(decodedToken.invitationId);

    if (!invitation) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token." });
    }

    if (invitation?.toJSON()?.status === "Accepted") {
      return ResponseHandler.success(res, {
        message: "The invite was already accepted.",
      });
    }

    invitation.token = null;
    invitation.status = "Accepted";
    await invitation.save();

    invitation = invitation.toJSON();

    let business = await Business.findByPk(invitation.businessId, {
      raw: true,
    });

    let user = await User.findOne({
      where: {
        email: invitation.email,
      },
      raw: true,
    });

    if (user) {
      await BusinessMembership.create({
        businessId: invitation.businessId,
        userId: user.id,
        role: "TeamMember",
      });
    }

    ResponseHandler.success(res, {
      message: `You have been added to the organization ${business.name}.`,
    });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    let invitation = await Invitation.findByPk(req.params.id, { raw: true });

    if (!invitation) {
      return ResponseHandler.success(res, { statusCode: 204 });
    }

    await Invitation.destroy({
      where: {
        id: req.params.id,
      },
    });

    if (invitation) {
      const user = await User.findOne({
        where: {
          email: invitation.email,
        },
        raw: true,
      });

      await BusinessMembership.destroy({
        userId: user.id,
        businessId: invitation.businessId,
      });

      const business = await Business.findOne({
        where: { id: invitation.businessId },
        include: [
          {
            model: User,
            as: "users",
            attributes: ["id", "name", "email"],
            through: {
              attributes: [],
              where: { role: "Admin" },
            },
          },
        ],
        raw: true,
        nest: true,
      });

      business.adminUser = business.users;
      delete business.users;

      let emailTemplate;

      if (invitation.status === "Pending") {
        emailTemplate = `Your invitation for organization ${business.name} has been cancelled.`;
      } else {
        emailTemplate = `${business.adminUser.email} removed you from organization ${business.name}.`;
      }

      await sendEmail(invitation.email, emailTemplate);

      // await SubscriptionService.updateFeatureUsage(
      //   TEAM_MEMBERS_FEATURE_ID,
      //   business.id,
      //   -1
      // );
    }

    ResponseHandler.success(res, { statusCode: 204 });
  })
);

router.get(
  "/",
  validateRequest(emailSchema, "query"),
  asyncHandler(async (req, res) => {
    const { email } = req.query;

    const invitations = await Invitation.findAll({
      where: {
        email,
      },
      raw: true,
    });

    ResponseHandler.success(res, { data: invitations });
  })
);

module.exports = router;
