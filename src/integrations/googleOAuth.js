const { google } = require("googleapis");
const oauthCredentials = require("../../credentials.json");
const moment = require("moment");
const Integration = require("../../models/integration");

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

const { client_secret, client_id, redirect_uris } = oauthCredentials.web;
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

function generateGoogleOAuthUrl() {
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
}

// async function getGoogleOAuthAccessToken(userId) {
//   try {
//     // Get credentials from database based on userId...
//     let credentials = {
//       access_token: "",
//       refresh_token: "",
//       scope: "https://www.googleapis.com/auth/calendar.events",
//       token_type: "Bearer",
//       expiry_date: 1703574184543,
//     };

//     oAuth2Client.setCredentials(credentials);

//     if (oAuth2Client.isTokenExpiring()) {
//       refreshAccessToken(userId);
//     }

//     return oAuth2Client;
//   } catch (error) {
//     console.error("getAccessToken error:", error);
//   }
// }

async function getTokenAsync(code) {
  return new Promise((resolve, reject) => {
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        console.error("Error retrieving google oauth access token", err);
        reject(err);
      } else {
        resolve(token);
      }
    });
  });
}

async function getGoogleOAuthAccessToken(code) {
  return new Promise((resolve, reject) => {
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        console.error("Error retrieving google oauth access token", err);
        reject(err);
      } else {
        const currentTime = moment();

        const futureTime = moment(token.expiry_date);
        const expiresIn = futureTime.diff(currentTime, "seconds");

        console.log("Google oauth token - ", token);

        const result = {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresIn: expiresIn,
        };

        resolve(result);
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

    await Integration.update(
      {
        accessToken: newToken.token,
        refreshToken: oAuth2Client.credentials.refresh_token,
        expirationTime: `${new Date(oAuth2Client.credentials.expiry_date)}`,
      },
      {
        where: {
          userId,
        },
      }
    );

    console.log("Access token refreshed.");
  } catch (err) {
    console.error("Error refreshing access token:", err.message);
  }
}

async function revokeAccessToken(accessToken) {
  try {
    await oAuth2Client.revokeToken(accessToken);
  } catch (err) {
    console.error("Error revoking access token:", err.message);
  }
}

module.exports = {
  generateGoogleOAuthUrl,
  getGoogleOAuthAccessToken,
  revokeAccessToken,
};
