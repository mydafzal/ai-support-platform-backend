const moment = require("moment/moment");
const fetch = require("node-fetch");
const { URLSearchParams } = require("url");

const { BusinessIntegration } = require("../../models");
const { CALENDLY_INTEGRATION_ID } = require("../utils/constants");

const authHeader =
  "Basic " +
  Buffer.from(
    `${process.env.CALENDLY_CLIENT_ID}:${process.env.CALENDLY_CLIENT_SECRET}`
  ).toString("base64");

async function getAvailableTimeSlots(
  requestedDate,
  nextThreeSlots = false,
  businessId
) {
  let businessIntegration = await BusinessIntegration.findOne({
    where: {
      businessId,
      integrationId: CALENDLY_INTEGRATION_ID,
    },
  });

  if (!businessIntegration) {
    return "Can't schedule meeting at this time!";
  }

  businessIntegration = businessIntegration.toJSON();
  let { accessToken, refreshToken, expirationTime } = businessIntegration;

  if (hasAccessTokenExpired(expirationTime)) {
    const updatedToken = await refreshCalendlyAccessToken(refreshToken);

    await BusinessIntegration.update(
      {
        accessToken: updatedToken.access_token,
        refreshToken: updatedToken.refresh_token,
        expirationTime: `${moment(new Date())
          .add(updatedToken.expiresIn, "seconds")
          .toDate()}`,
      },
      {
        where: {
          id: businessIntegration.id,
        },
      }
    );
  }

  const requestedSlot = `${moment(requestedDate).format("HH")}:00`;
  const hoursDifference = Math.abs(requestedDate?.getTimezoneOffset()) / 60;

  const startTime =
    hoursDifference !== 0
      ? moment(requestedDate)
          .subtract(hoursDifference, "hours")
          .toDate()
          .toString()
      : requestedDate.toString();

  requestedDate.setHours(23, 59, 59, 999);
  const endTime = requestedDate.toString();

  console.log("startTime - ", moment(new Date(startTime)).format("HH:mm a"));
  console.log("endTime - ", moment(new Date(endTime)).format("HH:mm a"));

  let options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  };

  const calendlyAccountDetails = await getCalendlyAccountDetails(accessToken);
  const user = calendlyAccountDetails?.resource?.uri;

  let response = await fetch(
    `https://api.calendly.com/event_types?user=${user}`,
    options
  );

  let data = await response.json();
  const eventUri = data.collection[0].uri;

  response = await fetch(
    `https://api.calendly.com/event_type_available_times?event_type=${eventUri}&start_time=${startTime}&end_time=${endTime}`,
    options
  );
  data = await response.json();

  const slots = data.collection?.map((item) => {
    let time = new Date(item.start_time);
    return moment(time).format("HH:mm");
  });

  console.log("slots", slots);

  if (nextThreeSlots === true) {
    let nextSlots = [];

    for (let i = 0; i < slots.length; i++) {
      if (slots[i] > requestedSlot) {
        nextSlots.push(slots[i]);

        if (nextSlots.length === 3) {
          break;
        }
      }
    }

    return `User refused the previous available slot you communicated to the user. So here are next available slots: ${nextSlots}`;
  }

  // const actualRequestedSlot = `${parseInt(requestedSlot.split(":")[0]) + 1}:00`;
  const actualRequestedSlot = `${parseInt(requestedSlot.split(":")[0])}:00`;

  console.log("requestedSlot", requestedSlot);
  console.log("actualRequestedSlot", actualRequestedSlot);

  if (!slots || slots?.length === 0) {
    return "No slots left for the given date.";
  } else if (slots.includes(actualRequestedSlot)) {
    return `Slot available: ${actualRequestedSlot}`;
  } else {
    let nextSlot;

    for (let i = 0; i < slots.length; i++) {
      if (slots[i] > actualRequestedSlot) {
        nextSlot = slots[i];
        break;
      }
    }

    return `Slot not available. Next available slot is ${nextSlot}`;
  }
}

async function getCalendlyAccessToken(code, redirecUri) {
  const encodedParams = new URLSearchParams();
  encodedParams.append("grant_type", "authorization_code");
  encodedParams.append("code", code);
  encodedParams.append("redirect_uri", redirecUri);

  try {
    const response = await fetch("https://auth.calendly.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader,
      },
      body: encodedParams,
    });

    let data = await response.json();
    console.log("getCalendlyAccessToken - response", data);

    data = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };

    return data;
  } catch (error) {
    console.log("Error getting calendly access token", error);
  }
}

async function refreshCalendlyAccessToken(refreshToken) {
  const encodedParams = new URLSearchParams();
  encodedParams.append("grant_type", "refresh_token");
  encodedParams.append("refresh_token", refreshToken);

  try {
    const response = await fetch("https://auth.calendly.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader,
      },
      body: encodedParams,
    });

    return await response.json();
  } catch (error) {
    console.log("Error getting calendly access token", error);
  }
}

function hasAccessTokenExpired(expirationTime) {
  return new Date() >= new Date(expirationTime);
}

async function getCalendlyAccountDetails(accessToken) {
  const response = await fetch("https://api.calendly.com/users/me", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return await response.json();
}

async function getOrganizationMember(
  accessToken,
  email,
  expirationTime,
  refreshToken
) {
  // if (hasAccessTokenExpired(expirationTime)) {
  //   const updatedCredentials = await refreshCalendlyAccessToken(refreshToken);
  //   accessToken = updatedCredentials.access_token;

  //   // Save to db.
  // }

  const calendlyAccountDetails = await getCalendlyAccountDetails(accessToken);
  const organizationUri = calendlyAccountDetails.resource.current_organization;

  console.log("calendlyAccountDetails", calendlyAccountDetails);
  console.log("organizationUri", organizationUri);

  const response = await fetch(
    `https://api.calendly.com/organization_memberships?organization=${organizationUri}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();
  console.log("getOrganizationMember - data", data);

  const members = data?.collection;
  members?.forEach((user) => console.log("----", user.user.email));

  // if (members?.length > 0) {
  //   return members.filter((user) => user.user.email === email);
  // }
}

module.exports = {
  getAvailableTimeSlots,
  getCalendlyAccessToken,
  refreshCalendlyAccessToken,
  getCalendlyAccountDetails,
  getOrganizationMember,
};
