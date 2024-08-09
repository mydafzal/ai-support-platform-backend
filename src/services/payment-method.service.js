const { Business, User } = require("../../models");
const { CARD_BRAND_LOGOS } = require("../utils/constants");
const StripeService = require("./stripe.service");

async function addPaymentMethod(data) {
  const { businessId } = data;

  let business = await Business.findOne({
    where: {
      id: businessId,
    },
    include: [
      {
        model: User,
        as: "adminUser",
        attributes: ["email"],
      },
    ],
    raw: true,
    nest: true,
  });

  if (!business) {
    throw { statusCode: 404, message: "Invalid business id." };
  }

  if (!business.stripeCustomerId) {
    const customer = await StripeService.createStripeCustomer(
      business.adminUser.email
    );

    await Business.update(
      {
        stripeCustomerId: customer.id,
      },
      {
        where: {
          id: businessId,
        },
      }
    );

    business.stripeCustomerId = customer.id;
  }

  const intent = await StripeService.createStripeSetupIntent(
    business.stripeCustomerId
  );

  return intent.client_secret;
}

async function setDefaultPaymentMethod(data) {
  const { businessId, paymentMethodId } = data;

  let business = await Business.findOne({
    where: {
      id: businessId,
    },
    raw: true,
  });

  if (!business) {
    throw { statusCode: 404, message: "Invalid business id." };
  }

  await StripeService.updateCustomerDefaultPaymentMethod(
    business.stripeCustomerId,
    paymentMethodId
  );
}

async function getPaymentMethodByBusiness(data) {
  const { businessId } = data;

  let business = await Business.findOne({
    where: {
      id: businessId,
    },
    raw: true,
  });

  if (!business) {
    throw { statusCode: 404, message: "Invalid business id." };
  }

  if (!business.stripeCustomerId) {
    throw { statusCode: 400, message: "No payment method added yet." };
  }

  const paymentMethod = await StripeService.getCustomerPaymentMethod(
    business.stripeCustomerId
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
  const { businessId, paymentMethodId } = data;

  let business = await Business.findOne({
    where: {
      id: businessId,
    },
    raw: true,
  });

  if (!business) {
    throw { statusCode: 404, message: "Invalid business id." };
  }

  await StripeService.detachStripePaymentMethod(paymentMethodId);

  const newPaymentMethod = await StripeService.getCustomerPaymentMethod(
    business.stripeCustomerId
  );

  if (newPaymentMethod) {
    await StripeService.updateCustomerDefaultPaymentMethod(
      business.stripeCustomerId,
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
