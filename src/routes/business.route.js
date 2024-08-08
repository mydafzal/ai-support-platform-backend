const sequelize = require("sequelize");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const {
  Business,
  User,
  Invitation,
  TeamGroup,
  Call,
  CallTag,
  Integration,
  BusinessIntegration,
  Chat,
  ChatWidget,
  PricingPlan,
  Feature,
  Subscription,
  SubscriptionFeature,
} = require("../../models");

const router = require("express").Router();

const { CARD_BRAND_LOGOS } = require("../utils/constants");
const { Sequelize } = require("sequelize");

const { redisClient } = require("../integrations/redis");
const {
  capitalizeFirstLetterOfEachWord,
  getNextMonthlyResetDate,
} = require("../utils/helpers");

const StripeService = require("../services/stripe.service");
const validateRequest = require("../middleware/requestValidation.middleware");
const {
  addBusinessSchema,
  updateBusinessSchema,
} = require("../validators/business.validator");
const BusinessService = require("../services/business.service");
const ResponseHandler = require("../utils/responseHandler");
const DocumentService = require("../services/document.service");
const UrlService = require("../services/url.service");
const ChatService = require("../services/chat.service");
const GroupService = require("../services/group.service");

router.post("/", validateRequest(addBusinessSchema), async (req, res, next) => {
  try {
    const result = await BusinessService.addBusiness(req.body);
    ResponseHandler.success(res, {
      statusCode: 201,
      data: result,
  });
  } catch (error) {
    console.error("Error adding business:", error);
    next(error);
  }
});

router.patch(
  "/:id",
  validateRequest(updateBusinessSchema),
  async (req, res, next) => {
    try {
      const result = await BusinessService.updateBusiness({
        businessId: req.params.id,
        ...req.body,
      });

      ResponseHandler.success(res, {
        message: "Business information updated successfully.",
        data: result,
      });
    } catch (error) {
      console.error("Error updating business information:", error);
      next(error);
    }
  }
);

router.get("/:id/documents", async (req, res, next) => {
  try {
    const { documents, pagination } =
      await DocumentService.getDocumentsByBusiness({
        businessId: req.params.id,
        ...req.query,
      });

    ResponseHandler.success(res, {
      data: documents,
      pagination,
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    next(error);
  }
});

router.get("/:id/urls", async (req, res, next) => {
  try {
    const { urls, pagination } = await UrlService.getUrlsByBusiness({
      businessId: req.params.id,
      ...req.query,
    });

    ResponseHandler.success(res, {
      data: urls,
      pagination,
    });
  } catch (error) {
    console.error("Error getting urls:", error);
    next(error);
  }
});

router.get("/:id/train-chat-messages", async (req, res, next) => {
  const businessId = req.params.id;

  try {
    let result = await redisClient.lRange(`train-chat-${businessId}`, 0, -1);

    result = result.map((item) => {
      item = JSON.parse(item);

      return {
        type: item.type,
        content: item.data.content,
        ...item.data?.additional_kwargs,
      };
    });

    result = result.filter((item) => !item.isUrl && !item.isDocument);

    res.status(200).json({ success: true, data: result?.reverse() });
  } catch (error) {
    console.error("Error getting train chat's messages:", error);
    next(error);
  }
});

router.get("/:id/chats", async (req, res, next) => {
  try {
    const result = await ervice.getChatsByBusiness({
      businessId: req.params.id,
    });

    ResponseHandler.success(res, { data: result });
  } catch (error) {
    console.error("Error getting chats:", error);
    next(error);
  }
});

router.get("/:id/team-groups", async (req, res, next) => {
  try {
    const result = await GroupService.getGroupsByBusiness({
      businessId: req.params.id,
    });

    ResponseHandler.success(res, {
      data: result,
    });
  } catch (error) {
    console.error("Error getting team groups:", error);
    next(error);
  }
});

router.get("/:id/calls", async (req, res, next) => {
  let { page = 1, pageSize = 10, callTagId } = req.query;

  if (page < 1) {
    page = 1;
  }
  if (pageSize < 1) {
    pageSize = 10;
  }

  try {
    const offset = (page - 1) * pageSize;

    let whereCondition = { businessId: req.params.id };
    if (callTagId) {
      whereCondition.callTagId = callTagId;
    }

    let calls = await Call.findAll({
      where: whereCondition,
      limit: parseInt(pageSize),
      offset: parseInt(offset),
      order: [["createdAt", "DESC"]],
    });

    const totalCount = await Call.count({
      where: whereCondition,
    });

    calls = calls.map((item) => item.toJSON());

    calls = await Promise.all(
      calls.map(async (call) => {
        let messages = await redisClient.lRange(
          `transcription-${call.id}`,
          0,
          -1
        );

        messages = messages.map((item) => {
          item = JSON.parse(item);

          console.log("item - ", item);

          return {
            type: item?.type,
            content: item?.content,
            timestamp: item?.timestamp,
          };
        });

        return {
          ...call,
          transcription: messages?.reverse(),
        };
      })
    );

    res.status(200).json({
      success: true,
      data: calls,
      pagination: { page, pageSize, totalCount },
    });
  } catch (error) {
    console.error("Error getting calls:", error);
    next(error);
  }
});

router.get("/:id/call-tags", async (req, res, next) => {
  try {
    let callTags = await CallTag.findAll({
      where: { businessId: req.params.id },
    });

    callTags = callTags.map((item) => item.toJSON());

    res.status(200).json({ success: true, data: callTags });
  } catch (error) {
    console.error("Error getting call tags:", error);
    next(error);
  }
});

router.get("/:id/integrations", async (req, res, next) => {
  const businessId = req.params.id;

  const { recommended } = req.query;

  let whereCondition = {};
  if (recommended == "true") {
    whereCondition.recommended = true;
  }

  try {
    let integrations = await Integration.findAll({
      where: whereCondition,
      include: [
        {
          model: BusinessIntegration,
          as: "integration",
          where: { businessId },
          attributes: [],
          required: false,
        },
      ],
      attributes: {
        include: [
          [
            Sequelize.literal(
              'CASE WHEN "integration"."businessId" IS NOT NULL THEN true ELSE false END'
            ),
            "connected",
          ],
          [Sequelize.col("integration.id"), "businessIntegrationId"],
        ],
      },
    });

    integrations = integrations.map((item) => item.toJSON());
    res.status(200).json({ success: true, data: integrations });
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    next(error);
  }
});

router.get("/:id/team", async (req, res, next) => {
  const businessId = req.params.id;

  try {
    let users = await User.findAll({
      where: {
        businessId,
      },
      attributes: {
        exclude: [
          "password",
          "emailVerificationToken",
          "resetPasswordToken",
          "externalType",
        ],
      },
      include: [
        { model: TeamGroup, as: "teamGroup", attributes: ["name", "id"] },
      ],
    });

    users = users?.map((item) => item.toJSON());

    let whereCondition = {
      businessId,
    };

    if (users?.length > 0) {
      whereCondition.email = {
        [sequelize.Op.notIn]: users.map((item) => item.email),
      };
    }

    let invitations = await Invitation.findAll({
      where: whereCondition,
      attributes: {
        exclude: ["token"],
      },
      include: [
        { model: TeamGroup, as: "teamGroup", attributes: ["name", "id"] },
      ],
    });

    invitations = invitations?.map((item) => item.toJSON());

    const teamMembers = [...users, ...invitations];
    res.status(200).json({ success: true, data: teamMembers });
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    next(error);
  }
});

router.get("/:id/chat-widgets", async (req, res, next) => {
  const businessId = req.params.id;

  try {
    let chatWidget = await ChatWidget.findOne({
      where: {
        businessId,
      },
    });

    if (!chatWidget) {
      return res
        .status(400)
        .json({ success: true, message: "Invalid chat widget id." });
    }

    res.status(200).json({ success: true, data: chatWidget });
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    next(error);
  }
});

router.delete("/:id/chats", async (req, res, next) => {
  const businessId = req.params.id;

  try {
    let business = await Business.findOne({
      where: {
        id: businessId,
      },
    });

    if (!business) {
      return res
        .status(400)
        .json({ success: true, message: "Invalid business id." });
    }

    await Chat.destroy({
      where: {
        businessId,
      },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    next(error);
  }
});

router.post("/:id/payment-methods", async (req, res, next) => {
  const businessId = req.params.id;

  try {
    let business = await Business.findOne({
      where: {
        id: businessId,
      },
      include: [
        {
          model: User,
          as: "adminUser",
          attributes: ["email"],
        },
      ],
    });

    if (!business) {
      return res
        .status(400)
        .json({ success: true, message: "Invalid business id." });
    }

    business = business.toJSON();

    if (!business.stripeCustomerId) {
      const customer = await StripeService.createStripeCustomer(
        business.adminUser.email
      );

      await Business.update(
        {
          stripeCustomerId: customer.id,
        },
        {
          where: {
            id: businessId,
          },
        }
      );

      business.stripeCustomerId = customer.id;
    }

    const intent = await StripeService.createStripeSetupIntent(
      business.stripeCustomerId
    );

    res.status(200).json({ clientSecret: intent.client_secret });
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    next(error);
  }
});

router.post("/:id/payment-methods", async (req, res, next) => {
  const businessId = req.params.id;

  try {
    let business = await Business.findOne({
      where: {
        id: businessId,
      },
      include: [
        {
          model: User,
          as: "adminUser",
          attributes: ["email"],
        },
      ],
    });

    if (!business) {
      return res
        .status(400)
        .json({ success: true, message: "Invalid business id." });
    }

    business = business.toJSON();

    if (!business.stripeCustomerId) {
      const customer = await StripeService.createStripeCustomer(
        business.adminUser.email
      );

      await Business.update(
        {
          stripeCustomerId: customer.id,
        },
        {
          where: {
            id: businessId,
          },
        }
      );

      business.stripeCustomerId = customer.id;
    }

    const intent = await StripeService.createStripeSetupIntent(
      business.stripeCustomerId
    );

    res.status(200).json({ clientSecret: intent.client_secret });
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    next(error);
  }
});

router.patch("/:id/payment-methods/:methodId", async (req, res, next) => {
  const businessId = req.params.id;
  const paymentMethodId = req.params.methodId;

  try {
    let business = await Business.findOne({
      where: {
        id: businessId,
      },
      raw: true,
    });

    if (!business) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid business id." });
    }

    await StripeService.updateCustomerDefaultPaymentMethod(
      business.stripeCustomerId,
      paymentMethodId
    );

    res
      .status(200)
      .json({ status: true, message: "Payment method set as default." });
  } catch (error) {
    console.error("Error updating default payment method - ", error);

    if (error.statusCode) {
      res
        .status(error.statusCode)
        .json({ success: false, message: error.message });
    } else {
      res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  }
});

router.get("/:id/payment-methods", async (req, res, next) => {
  const businessId = req.params.id;

  try {
    let business = await Business.findOne({
      where: {
        id: businessId,
      },
    });

    if (!business) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid business id." });
    }

    business = business.toJSON();

    if (!business.stripeCustomerId) {
      return res
        .status(400)
        .json({ status: false, message: "No payment method added yet." });
    }

    const allMethods = await stripe.customers.listPaymentMethods(
      business.stripeCustomerId,
      {
        limit: 1,
      }
    );

    const paymentMethod = allMethods.data[0];

    if (!paymentMethod) {
      return res
        .status(400)
        .json({ status: false, message: "No payment method added yet." });
    }

    const paymentMethodDetails = {
      brand: paymentMethod.card.brand,
      country: paymentMethod.card.country,
      expiryMonth: paymentMethod.card.exp_month,
      expiryYear: paymentMethod.card.exp_year,
      last4: paymentMethod.card.last4,
      createdAt: paymentMethod.created,
      cardBrandLogoUrl: CARD_BRAND_LOGOS[paymentMethod.card.brand],
      stripePaymentMethodId: paymentMethod.id,
    };

    res.status(200).json({ status: true, data: paymentMethodDetails });
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    next(error);
  }
});

router.delete("/:id/payment-methods/:methodId", async (req, res, next) => {
  const businessId = req.params.id;
  const paymentMethodId = req.params.methodId;

  try {
    let business = await Business.findOne({
      where: {
        id: businessId,
      },
      raw: true,
    });

    if (!business) {
      return res
        .status(400)
        .json({ success: true, message: "Invalid business id." });
    }

    await StripeService.detachStripePaymentMethod(paymentMethodId);

    const allMethods = await stripe.customers.listPaymentMethods(
      business.stripeCustomerId,
      {
        limit: 1,
      }
    );

    const newPaymentMethod = allMethods.data[0];

    if (newPaymentMethod) {
      await StripeService.updateCustomerDefaultPaymentMethod(
        business.stripeCustomerId,
        newPaymentMethod.id
      );
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error getting connected integrations:", error);
    next(error);
  }
});

router.get("/:id/pricing-plans", async (req, res, next) => {
  try {
    let pricingPlans = await PricingPlan.findAll({
      include: [
        {
          model: PricingPlan,
          as: "basePlan",
          attributes: ["id", "name"],
        },
        {
          model: Feature,
          as: "features",
          through: {
            attributes: [],
          },
        },
        {
          model: Subscription,
          as: "subscriptions",
          where: {
            businessId: req.params.id,
          },
          required: false,
          include: [
            {
              model: SubscriptionFeature,
              as: "subscriptionFeatures",
              attributes: ["featureId", "quantity"],
            },
          ],
          attributes: ["id", "planId"],
        },
      ],
      attributes: {
        include: [
          [
            Sequelize.literal(
              `CASE WHEN "subscriptions"."planId" IS NOT NULL THEN true ELSE false END`
            ),
            "isCurrentPlan",
          ],
          [
            Sequelize.col("features.PlanFeature.baseQuantity"),
            "features.baseQuantity",
          ],
          [Sequelize.col("features.id"), "features.id"],
          [Sequelize.col("features.nameSingular"), "features.nameSingular"],
          [Sequelize.col("features.namePlural"), "features.namePlural"],
          [Sequelize.col("features.unitPrice"), "features.unitPrice"],
          [Sequelize.col("features.createdAt"), "features.createdAt"],
          [Sequelize.col("features.updatedAt"), "features.updatedAt"],
        ],
        exclude: ["basePlanId"],
      },
      order: [
        ["id", "ASC"],
        ["features.id", "ASC"],
      ],
    });

    pricingPlans = pricingPlans.map((plan) => {
      const planData = plan.toJSON();

      if (planData.isCurrentPlan) {
        const subscription = planData.subscriptions?.[0];

        planData.features.forEach((feature) => {
          const subscriptionFeature = subscription?.subscriptionFeatures.find(
            (sf) => sf.featureId === feature.id
          );

          feature.baseQuantity = subscriptionFeature.quantity;
        });
      }

      delete planData.subscriptions;

      if (planData.basePlan) {
        let basePlanFeatures = pricingPlans.find(
          (plan) => plan.id == planData.basePlan.id
        ).features;

        basePlanFeatures = basePlanFeatures.map((item) => item.toJSON());

        // Remove features from this plan that are also included in its base plan.
        planData.features = planData.features.filter((feature) => {
          const existsInBasePlan = basePlanFeatures.some(
            (item) =>
              item.id === feature.id &&
              item.baseQuantity === feature.baseQuantity
          );

          return !existsInBasePlan;
        });
      }

      return planData;
    });

    return res.status(200).json({ success: true, data: pricingPlans });
  } catch (error) {
    console.error("Error getting pricing plans - ", error);
    next(error);
  }
});

router.get("/:id/subscriptions", async (req, res, next) => {
  try {
    let subscription = await Subscription.findOne({
      where: {
        businessId: req.params.id,
      },
      include: [
        {
          model: PricingPlan,
          as: "plan",
          attributes: {
            exclude: ["stripeProductId", "basePlanId"],
          },
        },
        {
          model: SubscriptionFeature,
          as: "subscriptionFeatures",
          attributes: {
            exclude: ["subscriptionId"],
          },
          include: [
            {
              model: Feature,
              as: "feature",
            },
          ],
        },
      ],
      attributes: {
        exclude: ["planId"],
      },
    });

    subscription = subscription.toJSON();

    subscription.subscriptionFeatures = subscription.subscriptionFeatures.map(
      (item) => {
        const featureName =
          item.feature.namePlural || item.feature.nameSingular;
        item.featureName = capitalizeFirstLetterOfEachWord(featureName);

        delete item.feature;
        return item;
      }
    );

    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    const formattedDate = getNextMonthlyResetDate(
      stripeSubscription.billing_cycle_anchor
    );

    subscription = {
      ...subscription,
      usageResetDate: formattedDate,
      status: stripeSubscription.status,
      startDate: stripeSubscription.start_date,
      price: stripeSubscription.items.data[0].price.unit_amount / 100, // convert from cents to dollars
      isScheduledForCancellation: stripeSubscription.cancel_at_period_end,
      currentPeriodEnd: stripeSubscription.current_period_end,
      billingCycle:
        stripeSubscription.items.data[0].price.recurring.interval === "month"
          ? "monthly"
          : "yearly",
    };

    res.status(200).json({ success: true, data: subscription });
  } catch (error) {
    console.log("error - ", error);
    res.status(400).send({ error: { message: error.message } });
  }
});

module.exports = router;
