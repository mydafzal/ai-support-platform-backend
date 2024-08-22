const router = require("express").Router();
const {
  BusinessIntegration,
  Business,
  FormLink,
  Integration,
  User,
} = require("../../models");

const { z } = require("zod");
const { HUBPOST_INTEGRATION_ID } = require("../utils/constants");
const { createContact } = require("../integrations/hubspotCRM");

const formValidationSchema = z.object({
  firstname: z.string(),
  lastname: z.string(),
  email: z.string().email(),
  phone: z.string(),
});

const jwt = require("jsonwebtoken");
const { sendEmail } = require("../integrations/nodemailer");

router.post("/", async (req, res) => {
  try {
    const { success, error } = await formValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { token } = req.query;
    const customerDetails = req.body;

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    let formLink = await FormLink.findOne({
      where: {
        token,
      },
      include: [
        {
          model: Business,
          as: "business",
          attributes: ["id"],
          include: {
            model: BusinessIntegration,
            as: "businessIntegrations",
            where: { integrationId: HUBPOST_INTEGRATION_ID },
          },
        },
      ],
      raw: true,
      nest: true,
    });

    if (!formLink) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid token." });
    }

    const businessIntegration = formLink.business.businessIntegrations;

    const { accessToken, refreshToken, expirationTime } = businessIntegration;

    await createContact(
      accessToken,
      refreshToken,
      expirationTime,
      formLink.business.id,
      customerDetails
    );

    if (decodedToken.leadMode) {
      const adminUser = await User.findOne({
        where: {
          businessId: formLink.business.id,
          role: "Admin",
        },
        raw: true,
      });

      const integration = await Integration.findOne({
        where: {
          id: HUBPOST_INTEGRATION_ID,
        },
        raw: true,
      });

      customerDetails.name = `${customerDetails.firstname} ${customerDetails.lastname}`;

      const emailTemplate = `
      <html>
        <body>
            <p>Dear ${adminUser.name},</p>
            <p>A new lead has been successfully captured and added to your CRM.</p>
            <p><strong>CRM:</strong> ${integration.name}</p>
            <p><strong>Lead Information:</strong></p>
            <ul>
                <li><strong>Name:</strong> ${customerDetails.name}</li>
                <li><strong>Phone Number:</strong> ${customerDetails.phone}</li>
                <li><strong>Email Address:</strong> ${customerDetails.email}</li>
            </ul>
            <p>Thank you for using CustomerBot. If you have any questions or need further assistance, please contact our support team.</p>
            <p>Best regards,<br>The CustomerBot Team</p>
        </body>
      </html>`;

      await sendEmail(adminUser.email, emailTemplate);
    }

    res.status(200).json({
      success: true,
      message: "Information saved successfully.",
    });
  } catch (error) {
    console.error("Error posting customer form: ", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

module.exports = router;
