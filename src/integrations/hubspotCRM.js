const fs = require("fs");
const path = require("path");

const hubspot = require("@hubspot/api-client");
const Integration = require("../models/integration.model");
const moment = require("moment");
const hubspotClient = new hubspot.Client({
  apiKey: process.env.HUBSPOT_API_KEY,
});

async function getHubSpotAccessToken(code, redirecUri) {
  try {
    const response = await hubspotClient.oauth.tokensApi.create(
      "authorization_code",
      code,
      redirecUri,
      process.env.HUBSPOT_CLIENT_ID,
      process.env.HUBSPOT_CLIENT_SECRET
    );

    return response;
  } catch (error) {
    console.log("hubspot get access token errro", error);
  }
}

async function getContactByPhoneNumber(
  accessToken,
  refreshToken,
  expirationTime,
  phoneNumber,
  businessId
) {
  const hubspot = require("@hubspot/api-client");
  const hubspotClient = new hubspot.Client({
    accessToken,
  });

  if (hasAccessTokenExpired(expirationTime)) {
    console.log("token expired.....");
    const updatedToken = await refreshAccessToken(refreshToken);

    await Integration.update(
      {
        accessToken: updatedToken.accessToken,
        refreshToken: updatedToken.refreshToken,
        expirationTime: moment(new Date())
          .add(updatedToken.expiresIn, "seconds")
          .toDate(),
      },
      {
        where: {
          businessId,
          integrationType: "HubSpot",
        },
      }
    );

    hubspotClient.setAccessToken(updatedToken?.accessToken);
  }

  const PublicObjectSearchRequest = {
    // query: "string",
    // limit: 1,
    // after: "string",
    // sorts: ["string"],
    properties: ["firstname", "lastname", "email", "phone", "company"],
    filterGroups: [
      {
        filters: [
          {
            propertyName: "phone",
            value: phoneNumber,
            operator: "EQ",
          },
        ],
      },
    ],
  };

  try {
    const apiResponse = await hubspotClient.crm.contacts.searchApi.doSearch(
      PublicObjectSearchRequest
    );

    console.log("get contact response,", apiResponse);

    if (apiResponse.total < 1) {
      console.log("Hubspot contact not found");
      return null;
    }

    return apiResponse.results[0];
  } catch (error) {
    console.log("getContactByPhoneNumber error", error);
  }
}

async function refreshAccessToken(refreshToken) {
  try {
    const response = await hubspotClient.oauth.tokensApi.create(
      "refresh_token",
      null,
      "http://localhost:5000/crm/redirect",
      process.env.HUBSPOT_CLIENT_ID,
      process.env.HUBSPOT_CLIENT_SECRET,
      refreshToken
    );

    console.log("refreshed hubspot oauth tokens", response);
    return response;
  } catch (error) {
    console.log("refreshAccessToken error", error);
  }
}

function hasAccessTokenExpired(expirationTime) {
  // const currentTime = Math.floor(new Date().getTime() / 1000);

  return new Date() >= new Date(expirationTime);
}

async function readAllProperties(accessToken) {
  const filePath = path.join(__dirname, "token.json");
  const token = fs.readFileSync(filePath, { encoding: "utf-8" });
  accessToken = JSON.parse(token).accessToken;

  const hubspot = require("@hubspot/api-client");
  const hubspotClient = new hubspot.Client({
    accessToken,
  });

  // const objectType = "contacts";
  // const groupName = "contactinformation";

  // contactinformation

  // try {
  //   // const apiResponse = await hubspotClient.crm.properties.groupsApi.getAll(
  //   //   objectType
  //   // );
  //   // console.log(JSON.stringify(apiResponse, null, 2));

  //   const apiResponse = await hubspotClient.crm.properties.groupsApi.getByName(
  //     objectType,
  //     groupName
  //   );

  //   console.log(JSON.stringify(apiResponse, null, 2));
  // } catch (e) {
  //   e.message === "HTTP request failed"
  //     ? console.error(JSON.stringify(e.response, null, 2))
  //     : console.error(e);
  // }

  const objectType = "contacts";
  const archived = false;
  const properties = undefined;

  try {
    const apiResponse = await hubspotClient.crm.properties.coreApi.getAll(
      objectType,
      archived,
      properties
    );
    console.log("all properties...");

    const propertyNames = apiResponse.results.map((property) => property.name);
    console.log(
      "properties",
      apiResponse.results
        .filter((property) => property.groupName === "contactinformation")
        .map((item) => item.name)
    );

    return apiResponse;
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
}

module.exports = {
  getHubSpotAccessToken,
  getContactByPhoneNumber,
  readAllProperties,
};
