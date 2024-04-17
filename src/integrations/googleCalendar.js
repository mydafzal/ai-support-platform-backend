const { google } = require("googleapis");
const credentials = require("../../credentials.json");

const { BusinessIntegration } = require("../../models");
const { GOOGLE_CALENDAR_INTEGRATION_ID } = require("../utils/constants");

let auth, calendar;

async function authorize(businessId) {
  const { client_secret, client_id, redirect_uris } = credentials.web;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  try {
    let businessIntegration = await BusinessIntegration.findOne({
      where: {
        businessId,
        integrationId: GOOGLE_CALENDAR_INTEGRATION_ID,
      },
    });

    if (!businessIntegration) {
      return "Can't schedule meeting at this time!";
    }

    businessIntegration = businessIntegration.toJSON();
    let { accessToken, refreshToken, expirationTime } = businessIntegration;

    console.log("businessIntegration - ", businessIntegration);

    const differenceInMilliseconds =
      new Date(expirationTime).getTime() - new Date().getTime();

    oAuth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: differenceInMilliseconds,
      token_type: "bearer",
    });

    if (oAuth2Client.isTokenExpiring()) {
      const newToken = await refreshAccessToken(oAuth2Client);

      oAuth2Client.setCredentials({
        access_token: newToken.token,
        refresh_token: oAuth2Client.credentials.refresh_token,
        token_type: oAuth2Client.credentials.token_type,
        expiry_date: oAuth2Client.credentials.expiry_date,
      });

      await BusinessIntegration.update(
        {
          accessToken: newToken.token,
        },
        {
          where: {
            id: businessIntegration.id,
          },
        }
      );
    }

    return oAuth2Client;
  } catch (error) {
    console.log("Google Calendar authorize - error - ", error);
  }
}

async function refreshAccessToken(oAuth2Client) {
  try {
    const newToken = await oAuth2Client.getAccessToken();
    console.log("Access token refreshed.");

    return newToken;
  } catch (err) {
    console.error("Error refreshing access token:", err);
  }
}

async function addEventToGoogleCalendar(
  businessId,
  customerEmail,
  meetingDescription,
  start,
  end
) {
  if (!auth) {
    auth = await authorize(businessId);
  }

  if (!calendar) {
    calendar = google.calendar({ version: "v3", auth });
  }

  const event = {
    summary: "Customer Bot Meeting",
    description: meetingDescription,
    start: {
      dateTime: start,
      timeZone: "America/Los_Angeles",
    },
    end: {
      dateTime: end,
      timeZone: "America/Los_Angeles",
    },
    attendees: [{ email: customerEmail }],
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 10 },
      ],
    },
    conferenceData: {
      createRequest: {
        requestId: "customer-bot",
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    },
  };

  calendar.events.insert(
    {
      calendarId: "hammad@cheetahagency.com",
      requestBody: event,
      sendNotifications: true,
      sendUpdates: "all",
      conferenceDataVersion: 1,
    },
    function (err, event) {
      if (err) {
        console.log(
          "There was an error contacting the Calendar service: " + err
        );
        return;
      }

      console.log("Event created");
    }
  );
}

module.exports = { addEventToGoogleCalendar };
