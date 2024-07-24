const stripe = require("../config/stripeConfig");

async function createStripeSubscription(
  customerId,
  productId,
  billingCycle,
  totalCostInCents,
  paymentMethod
) {
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
  subscriptionItemId
) {
  return await stripe.subscriptions.update(subscriptionId, {
    payment_behavior: "pending_if_incomplete",
    proration_behavior: "always_invoice",

    items: [
      {
        id: subscriptionItemId,
        price: newPriceId,
      },
    ],
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

async function updateSubscriptionDefaultPaymentMethod(
  subscriptionId,
  newPaymentMethodId
) {
  await stripe.subscriptions.update(subscriptionId, {
    default_payment_method: newPaymentMethodId,
  });
}

async function updateCustomerDefaultPaymentMethod(
  customerId,
  newPaymentMethodId
) {
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: newPaymentMethodId,
    },
  });
}

async function detachStripePaymentMethod(paymentMethodId) {
  await stripe.paymentMethods.detach(paymentMethodId);
}

async function voidInvoice(invoiceId) {
  await stripe.invoices.voidInvoice(invoiceId);
}

async function getStripeCustomer(customerId) {
  return await stripe.customers.retrieve(customerId);
}

async function createStripeCustomer(email) {
  return await stripe.customers.create({
    email,
  });
}

async function createStripeSetupIntent(customerId) {
  return await stripe.setupIntents.create({
    customer: customerId,
  });
}

async function refundCreditBalanceToCustomer(customerId, subscriptionId) {
  const customer = await getStripeCustomer(customerId);
  customer.balance = Math.abs(customer.balance);

  const invoices = await stripe.invoices.list({
    subscription: subscriptionId,
    expand: ["data.charge"],
  });

  await Promise.all(
    invoices.data.map(async (invoice) => {
      if (invoice.charge && invoice.charge.amount <= customer.balance) {
        customer.balance -= invoice.charge.amount;

        await stripe.refunds.create({
          charge: invoice.charge.id,

          amount: invoice.charge.amount,
        });
      }
    })
  );

  await stripe.customers.update(customerId, {
    balance: 0,
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
  updateSubscriptionDefaultPaymentMethod,
  detachStripePaymentMethod,
  voidInvoice,
  getStripeCustomer,
  createStripeCustomer,
  createStripeSetupIntent,
  refundCreditBalanceToCustomer,
  updateCustomerDefaultPaymentMethod,
};
module.exports = StripeService;
