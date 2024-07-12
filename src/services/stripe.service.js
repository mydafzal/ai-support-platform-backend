const stripe = require("../config/stripeConfig");

async function createStripeSubscription(
  customerId,
  productId,
  billingCycle,
  totalCostInCents
) {
  const paymentMethod = await getCustomerPaymentMethod(customerId);

  let subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [
      {
        price_data: {
          currency: "USD",
          product: productId,
          recurring: {
            interval: billingCycle === "monthly" ? "month" : "year",
          },
          unit_amount: totalCostInCents,
        },
      },
    ],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
  });

  if (subscription.latest_invoice.payment_intent) {
    await stripe.paymentIntents.confirm(
      subscription.latest_invoice.payment_intent.id,
      {
        payment_method: paymentMethod.id,
      }
    );
  }

  return subscription;
}

async function getCustomerPaymentMethod(customerId) {
  const paymentMethods = await stripe.customers.listPaymentMethods(customerId, {
    limit: 1,
  });

  return paymentMethods.data[0];
}

const StripeService = { createStripeSubscription, getCustomerPaymentMethod };
module.exports = StripeService;
