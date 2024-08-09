const Router = require("express").Router;
const router = Router();

const AuthService = require("../services/auth.service");

const validateRequest = require("../middleware/request-validation.middleware");
const ResponseHandler = require("../utils/response-handler");

const {
  loginSchema,
  emailSchema,
  passwordSchema,
} = require("../validators/auth.validator");
const asyncHandler = require("../utils/async-handler");

router.post(
  "/login",
  validateRequest(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await AuthService.login(req.body);
    ResponseHandler.success(res, { data: result });
  })
);

router.post(
  "/forgot-password",
  validateRequest(emailSchema),
  asyncHandler(async (req, res) => {
    await AuthService.generatePasswordResetLink(req.body);
    ResponseHandler.success(res, {
      message: "Password reset instructions sent to your email.",
    });
  })
);

router.post(
  "/reset-password/:token",
  validateRequest(passwordSchema),
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    await AuthService.resetPassword({ token, password });
    ResponseHandler.success(res, {
      message: "Password reset successfully.",
    });
  })
);

router.get(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const { token } = req.query;
    const authToken = await AuthService.verifyEmail({ token });

    ResponseHandler.success(res, {
      data: authToken,
      message: "Email verified successfully",
    });
  })
);

router.post(
  "/resend-verification-email",
  validateRequest(emailSchema),
  asyncHandler(async (req, res) => {
    await AuthService.resendEmailVerificationLink(req.body);
    ResponseHandler.success(res, { message: "Verification email resent" });
  })
);

module.exports = router;
