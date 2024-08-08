const Router = require("express").Router;
const router = Router();

const AuthService = require("../services/auth.service");

const validateRequest = require("../middleware/requestValidation.middleware");
const ResponseHandler = require("../utils/responseHandler");

const {
  loginSchema,
  emailSchema,
  passwordSchema,
} = require("../validators/auth.validator");

router.post("/login", validateRequest(loginSchema), async (req, res, next) => {
  try {
    const result = await AuthService.login(req.body);
    ResponseHandler.success(res, { data: result });
  } catch (error) {
    console.error("Error during login - ", error);
    next(error);
  }
});

router.post(
  "/forgot-password",
  validateRequest(emailSchema),
  async (req, res, next) => {
    try {
      await AuthService.generatePasswordResetLink(req.body);
      ResponseHandler.success(res, {
        message: "Password reset instructions sent to your email.",
      });
    } catch (error) {
      console.log("Error forgot-password", error);
      next(error);
    }
  }
);

router.post(
  "/reset-password/:token",
  validateRequest(passwordSchema),
  async (req, res, next) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
      await AuthService.resetPassword({ token, password });
      ResponseHandler.success(res, {
        message: "Password reset successfully.",
      });
    } catch (error) {
      console.error("Error occurred while resetting passsword: ", error);
      next(error);
    }
  }
);

router.get("/verify-email", async (req, res, next) => {
  try {
    const { token } = req.query;
    const authToken = await AuthService.verifyEmail({ token });

    ResponseHandler.success(res, {
      data: authToken,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Error verifying email:", err);
    next(error);
  }
});

router.post(
  "/resend-verification-email",
  validateRequest(emailSchema),
  async (req, res) => {
    try {
      await AuthService.resendEmailVerificationLink(req.body);
      ResponseHandler.success(res, { message: "Verification email resent" });
    } catch (err) {
      console.error("Error sending email verification link - ", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

module.exports = router;
