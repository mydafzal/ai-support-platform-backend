const Router = require("express").Router;
const router = Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const { Business, PricingPlan } = require("../../models");

router.post("/", async (req, res) => {
  const { businessId, planId, billingCycle } = req.body;

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

    let pricingPlan = await PricingPlan.findOne({
      id: planId,
    });

    if (!pricingPlan) {
      return res.status(400).json({
        success: false,
        message: "Please add a payment method first.",
      });
    }

    business = business.toJSON();
    pricingPlan = pricingPlan.toJSON();

    if (!business.stripeAccountId) {
      return res.status(400).json({
        success: false,
        message: "Please add a payment method first.",
      });
    }

    const paymentMethods = await stripe.customers.listPaymentMethods(
      business.stripeCustomerId,
      {
        limit: 1,
      }
    );

    if (!paymentMethods || paymentMethods.data.length < 1) {
      return res.status(400).json({
        success: false,
        message: "Please add a payment method first.",
      });
    }

    const prices = await stripe.prices.search({
      query: `product:'${pricingPlan.stripeProductId}' AND recurring['interval']:'${billingCycle}'`,
    });

    const subscription = await stripe.subscriptions.create({
      customer: business.stripeCustomerId,
      items: [{ price: prices.data[0].id }],
      expand: ["latest_invoice.payment_intent"],
    });

    res.status(200).send(subscription);
  } catch (error) {
    res.status(400).send({ error: { message: error.message } });
  }
});

module.exports = router;
