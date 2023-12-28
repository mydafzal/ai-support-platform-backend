const { google } = require("googleapis");
const oauthCredentials = require("../credentials.json");

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

const { client_secret, client_id, redirect_uris } = oauthCredentials.installed;
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

function generateOAuthUrl() {
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
}

async function storeAccessToken(userId, code) {
  try {
    // If not credentials in database, it means the user have not authorized yet.
    let credentials = await getTokenAsync(oAuth2Client, code);

    // Then save token object to database based on userId...

    return credentials;
  } catch (error) {
    console.log("error");
  }
}

async function getAccessToken(userId) {
  try {
    // Get credentials from database based on userId...
    let credentials = {
      access_token: "",
      refresh_token: "",
      scope: "https://www.googleapis.com/auth/calendar.events",
      token_type: "Bearer",
      expiry_date: 1703574184543,
    };

    oAuth2Client.setCredentials(credentials);

    if (oAuth2Client.isTokenExpiring()) {
      refreshAccessToken(userId);
    }

    return oAuth2Client;
  } catch (error) {
    console.error("getAccessToken error:", error);
  }
}

async function getTokenAsync(code) {
  return new Promise((resolve, reject) => {
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        console.error("Error retrieving access token", err);
        reject(err);
      } else {
        resolve(token);
      }
    });
  });
}

async function refreshAccessToken(userId) {
  try {
    const newToken = await oAuth2Client.getAccessToken();

    oAuth2Client.setCredentials({
      access_token: newToken.token,
      refresh_token: oAuth2Client.credentials.refresh_token,
      scope: oAuth2Client.credentials.scope,
      token_type: oAuth2Client.credentials.token_type,
      expiry_date: oAuth2Client.credentials.expiry_date,
    });

    // Store update credentials to database based on userId
    console.log("Access token refreshed.");
  } catch (err) {
    console.error("Error refreshing access token:", err.message);
  }
}

module.exports = { generateOAuthUrl, getAccessToken, storeAccessToken };
