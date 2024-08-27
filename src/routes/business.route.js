const { ChatWidget } = require("../../models");

const router = require("express").Router();

const { redisClient } = require("../integrations/redis");

const validateRequest = require("../middleware/request-validation.middleware");
const {
  addBusinessSchema,
  updateBusinessSchema,
  businessIdSchema,
} = require("../validators/business.validator");

const BusinessService = require("../services/business.service");
const ResponseHandler = require("../utils/response-handler");
const DocumentService = require("../services/document.service");
const UrlService = require("../services/url.service");
const ChatService = require("../services/chat.service");
const GroupService = require("../services/group.service");
const CallService = require("../services/call.service");
const CallTagService = require("../services/call-tags.service");
const IntegrationService = require("../services/integration.service");
const UserService = require("../services/user.service");
const asyncHandler = require("../utils/async-handler");

router.post(
  "/",
  validateRequest(addBusinessSchema),
  asyncHandler(async (req, res) => {
    const result = await BusinessService.addBusiness(req.body);
    ResponseHandler.success(res, {
      statusCode: 201,
      data: result,
    });
  })
);

router.get(
  "/:id",
  validateRequest(businessIdSchema, "params"),
  asyncHandler(async (req, res) => {
    const result = await BusinessService.getBusinessDetails({
      businessId: req.params.id,
    });

    ResponseHandler.success(res, {
      statusCode: 200,
      data: result,
    });
  })
);

router.delete(
  "/:id",
  validateRequest(businessIdSchema, "params"),
  asyncHandler(async (req, res) => {
    await BusinessService.deleteBusiness({
      businessId: req.params.id,
    });

    ResponseHandler.success(res, { statusCode: 204 });
  })
);

router.patch(
  "/:id",
  validateRequest(updateBusinessSchema),
  asyncHandler(async (req, res) => {
    const result = await BusinessService.updateBusiness({
      businessId: req.params.id,
      ...req.body,
    });

    ResponseHandler.success(res, {
      message: "Business information updated successfully.",
      data: result,
    });
  })
);

router.get(
  "/:id/documents",
  asyncHandler(async (req, res) => {
    const { documents, pagination } =
      await DocumentService.getDocumentsByBusiness({
        businessId: req.params.id,
        ...req.query,
      });

    ResponseHandler.success(res, {
      data: documents,
      pagination,
    });
  })
);

router.get(
  "/:id/urls",
  asyncHandler(async (req, res) => {
    const { urls, pagination } = await UrlService.getUrlsByBusiness({
      businessId: req.params.id,
      ...req.query,
    });

    ResponseHandler.success(res, {
      data: urls,
      pagination,
    });
  })
);

router.get(
  "/:id/train-chat-messages",
  asyncHandler(async (req, res) => {
    const businessId = req.params.id;

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

    ResponseHandler.success(res, { data: result?.reverse() });
  })
);

router.get(
  "/:id/chats",
  asyncHandler(async (req, res) => {
    const result = await ChatService.getChatsByBusiness({
      businessId: req.params.id,
    });

    ResponseHandler.success(res, { data: result });
  })
);

router.get(
  "/:id/groups",
  asyncHandler(async (req, res) => {
    const result = await GroupService.getGroupsByBusiness({
      businessId: req.params.id,
    });

    ResponseHandler.success(res, {
      data: result,
    });
  })
);

router.get(
  "/:id/calls",
  asyncHandler(async (req, res) => {
    const { calls, pagination } = await CallService.getCallsByBusiness({
      businessId: req.params.id,
      ...req.query,
    });

    ResponseHandler.success(res, { data: calls, pagination });
  })
);

router.get(
  "/:id/call-tags",
  asyncHandler(async (req, res) => {
    let callTags = await CallTagService.getCallTagsByBusiness({
      businessId: req.params.id,
    });

    ResponseHandler.success(res, { data: callTags });
  })
);

router.get(
  "/:id/integrations",
  asyncHandler(async (req, res) => {
    let integrations = await IntegrationService.getIntegrationsByBusiness({
      businessId: req.params.id,
      ...req.query,
    });

    ResponseHandler.success(res, { data: integrations });
  })
);

router.get(
  "/:id/team",
  asyncHandler(async (req, res) => {
    const teamMembers = await UserService.getUsersByBusiness({
      businessId: req.params.id,
    });

    ResponseHandler.success(res, { data: teamMembers });
  })
);

router.delete(
  "/:id/members/:memberId",
  asyncHandler(async (req, res) => {
    await BusinessService.removeMember({
      businessId: req.params.id,
      memberId: req.params.memberId,
    });

    ResponseHandler.success(res, { statusCode: 204 });
  })
);

router.get(
  "/:id/chat-widgets",
  asyncHandler(async (req, res) => {
    let chatWidget = await ChatWidget.findOne({
      where: {
        businessId: req.params.id,
      },
      raw: true,
    });

    ResponseHandler.success(res, { data: chatWidget });
  })
);

router.delete(
  "/:id/chats",
  asyncHandler(async (req, res) => {
    await ChatService.deleteChatsByBusiness({
      businessId: req.params.id,
    });

    ResponseHandler.success(res, { statusCode: 204 });
  })
);

module.exports = router;
