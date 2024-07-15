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

async function updateStripeSubscriptionPrice(
  subscriptionId,
  newPriceId,
  subscriptionItemId,
  paymentMethodId
) {
  await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscriptionItemId,
        deleted: true,
      },
      {
        price: newPriceId,
      },
    ],
    default_payment_method: paymentMethodId,
  });
}

async function getStripeSubscription(subscriptionId) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

async function cancelStripeSubscription(subscriptionId) {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

async function resumeStripeSubscription(subscriptionId) {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

async function getCustomerPaymentMethod(customerId) {
  const paymentMethods = await stripe.customers.listPaymentMethods(customerId, {
    limit: 1,
  });

  return paymentMethods.data[0];
}

async function createStripePrice(totalCostInCents, productId, billingCycle) {
  return await stripe.prices.create({
    currency: "usd",
    unit_amount: totalCostInCents,
    recurring: {
      interval: billingCycle === "monthly" ? "month" : "year",
    },
    product: productId,
  });
}

const StripeService = {
  createStripeSubscription,
  getCustomerPaymentMethod,
  getStripeSubscription,
  createStripePrice,
  updateStripeSubscriptionPrice,
  cancelStripeSubscription,
  resumeStripeSubscription,
};
module.exports = StripeService;
