const hubspot = require("@hubspot/api-client");
// const hubspotClient = new hubspot.Client({ accessToken: YOUR_ACCESS_TOKEN, api });
const hubspotClient = new hubspot.Client({
  apiKey: "ca08f1ba-50f3-4ff1-9912-86ed3baf0e1f",
});

const token = "token";

const client_id = "c168eab0-d901-49a0-9137-e6cd0212e043";
const client_secret = "efc3f92d-f209-49f8-b3ef-f5a4b845a512";

async function getHubSpotAccessToken(code) {
  try {
    const apiResponse = await hubspotClient.oauth.tokensApi.create(
      "authorization_code",
      code,
      "http://localhost:5000/crm/redirect",
      client_id,
      client_secret
    );
    console.log(JSON.stringify(apiResponse, null, 2));
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
}

async function listContacts() {
  const hubspot = require("@hubspot/api-client");

  const hubspotClient = new hubspot.Client({
    accessToken:
      "CJGA6IHTMRIMAAEAUAAAAQIAAAAMGPH0uhUg0KyWHijdjqkBMhTguQJv_OH_vhn4UMkVJdugCtK-mjowAAAAQQAAAAAAAAAAAAAAAACGAAAAAAAAAAAAIAAAAA4A4CEAAAAAAIAfAAAAAHACQhRQ5_OUVZJv13V-miupdVQHInelNEoDbmExUgBaAA",
  });

  const contactId = 51;
  const properties = ["phone", "email", "firstname"];
  const propertiesWithHistory = undefined;
  const associations = undefined;
  const archived = false;

  try {
    const apiResponse = await hubspotClient.crm.contacts.basicApi.getById(
      contactId,
      properties,
      propertiesWithHistory,
      associations,
      archived
    );
    console.log(JSON.stringify(apiResponse, null, 2));
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
}

async function getContactByPhoneNumber(phoneNumber) {
  const hubspot = require("@hubspot/api-client");

  const hubspotClient = new hubspot.Client({
    accessToken:
      "CJGA6IHTMRIMAAEAUAAAAQIAAAAMGPH0uhUg0KyWHijdjqkBMhTguQJv_OH_vhn4UMkVJdugCtK-mjowAAAAQQAAAAAAAAAAAAAAAACGAAAAAAAAAAAAIAAAAA4A4CEAAAAAAIAfAAAAAHACQhRQ5_OUVZJv13V-miupdVQHInelNEoDbmExUgBaAA",
  });

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
            // highValue: "string",
            // propertyName: "phone",
            propertyName: "phone",
            // values: ["string"],
            value: "+923055952372",
            // value: "bhhh@hubspot.com",
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

    console.log("contact response.");
    console.log(JSON.stringify(apiResponse, null, 2));
  } catch (e) {
    e.message === "HTTP request failed"
      ? console.error(JSON.stringify(e.response, null, 2))
      : console.error(e);
  }
}

module.exports = {
  getHubSpotAccessToken,
  listContacts,
  getContactByPhoneNumber,
};
