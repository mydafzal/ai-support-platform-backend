const { Business, User } = require("../../models");
const { CARD_BRAND_LOGOS } = require("../utils/constants");
const StripeService = require("./stripe.service");

async function addPaymentMethod(data) {
  const { userId } = data;

  let user = await User.findOne({
    where: {
      id: userId,
    },
    attributes: ["email"],
    raw: true,
  });

  if (!user) {
    throw { statusCode: 404, message: "Invalid user id." };
  }

  if (!user.stripeCustomerId) {
    const customer = await StripeService.createStripeCustomer(user.email);

    await User.update(
      {
        stripeCustomerId: customer.id,
      },
      {
        where: {
          id: userId,
        },
      }
    );

    user.stripeCustomerId = customer.id;
  }

  const intent = await StripeService.createStripeSetupIntent(
    user.stripeCustomerId
  );

  return intent.client_secret;
}

async function setDefaultPaymentMethod(data) {
  const { userId, paymentMethodId } = data;

  let user = await User.findOne({
    where: {
      id: userId,
    },
    raw: true,
  });

  if (!user) {
    throw { statusCode: 404, message: "Invalid user id." };
  }

  await StripeService.updateCustomerDefaultPaymentMethod(
    user.stripeCustomerId,
    paymentMethodId
  );
}

async function getPaymentMethodByBusiness(data) {
  const { userId } = data;

  let user = await User.findOne({
    where: {
      id: userId,
    },
    raw: true,
  });

  if (!user) {
    throw { statusCode: 404, message: "Invalid user id." };
  }

  if (!user.stripeCustomerId) {
    throw { statusCode: 400, message: "No payment method added yet." };
  }

  const paymentMethod = await StripeService.getCustomerPaymentMethod(
    user.stripeCustomerId
  );

  if (!paymentMethod) {
    throw { statusCode: 404, message: "No payment method added yet." };
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

  return paymentMethodDetails;
}

async function deletePaymentMethod(data) {
  const { userId, paymentMethodId } = data;

  let user = await User.findOne({
    where: {
      id: userId,
    },
    raw: true,
  });

  if (!user) {
    throw { statusCode: 404, message: "Invalid user id." };
  }

  await StripeService.detachStripePaymentMethod(paymentMethodId);

  const newPaymentMethod = await StripeService.getCustomerPaymentMethod(
    user.stripeCustomerId
  );

  if (newPaymentMethod) {
    await StripeService.updateCustomerDefaultPaymentMethod(
      user.stripeCustomerId,
      newPaymentMethod.id
    );
  }
}

const PaymentMethodService = {
  addPaymentMethod,
  setDefaultPaymentMethod,
  getPaymentMethodByBusiness,
  deletePaymentMethod,
};
module.exports = PaymentMethodService;
