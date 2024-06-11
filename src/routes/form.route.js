const router = require("express").Router();
const { BusinessIntegration, Business, FormLink } = require("../../models");

const { z } = require("zod");
const { HUBPOST_INTEGRATION_ID } = require("../utils/constants");
const { createContact } = require("../integrations/hubspotCRM");

const formValidationSchema = z.object({
  firstname: z.string(),
  lastname: z.string(),
  email: z.string().email(),
  phone: z.string(),
});

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

    console.log("form link - token - ", token);

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
    });

    console.log("form link - query result - ", formLink);

    if (!formLink) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid token." });
    }

    formLink = formLink.toJSON();

    const businessIntegration = formLink.business.businessIntegrations[0];

    const { accessToken, refreshToken, expirationTime } = businessIntegration;

    await createContact(
      accessToken,
      refreshToken,
      expirationTime,
      formLink.business.id,
      req.body
    );

    res.status(200).json({
      success: true,
      data: formLink,
    });
  } catch (error) {
    console.error("Error posting customer form: ", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

module.exports = router;
