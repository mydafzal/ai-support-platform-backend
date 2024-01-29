const { google } = require("googleapis");
const key = require("../../keyfile.json");
const credentials = require("../../credentials.json");
const fs = require("fs");
const readline = require("readline");

const path = require("path");

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
// const TOKEN_PATH = "./token.json";
const TOKEN_PATH = path.join(__dirname, "..", "token.json");

let auth, calendar;

// async function getCalendarEvents() {
//   const response = await calendar.events.list({
//     // calendarId: "primary",
//     calendarId: "hammadfarooq233@gmail.com",
//     timeMin: new Date().toISOString(),
//     maxResults: 10,
//     singleEvents: true,
//     orderBy: "startTime",
//   });

//   const events = response.data.items;

//   console.log("data", response.data);

//   if (events.length) {
//     console.log("Upcoming events:");

//     events.forEach((event) => {
//       const start = event.start.dateTime || event.start.date;
//       console.log(`${start} - ${event.summary}`);
//     });
//   } else {
//     console.log("No upcoming events found.");
//   }
// }

async function authorize() {
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  try {
    const token = fs.readFileSync(TOKEN_PATH);

    console.log("token path", token);

    oAuth2Client.setCredentials(JSON.parse(token));

    if (oAuth2Client.isTokenExpiring()) {
      await refreshAccessToken(oAuth2Client);
    }

    return oAuth2Client;
  } catch (error) {
    console.log("getAccessToken --------");

    return await getAccessToken(oAuth2Client);
  }
}

async function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("Authorize this app by visiting this URL:", authUrl);

  const code = await askQuestion("Enter the code from that page here: ");

  try {
    const token = await getTokenAsync(oAuth2Client, code);
    await writeTokenToFile(token);

    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function getTokenAsync(oAuth2Client, code) {
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

async function writeTokenToFile(token) {
  return new Promise((resolve, reject) => {
    fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
      if (err) {
        reject(err);
      } else {
        console.log("Token stored to", TOKEN_PATH);
        resolve(token);
      }
    });
  });
}

async function refreshAccessToken(oAuth2Client) {
  try {
    const newToken = await oAuth2Client.getAccessToken();

    oAuth2Client.setCredentials({
      access_token: newToken.token,
      refresh_token: oAuth2Client.credentials.refresh_token,
      scope: oAuth2Client.credentials.scope,
      token_type: oAuth2Client.credentials.token_type,
      expiry_date: oAuth2Client.credentials.expiry_date,
    });

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(oAuth2Client.credentials));
    console.log("Access token refreshed.");
  } catch (err) {
    console.error("Error refreshing access token:", err.message);
  }
}

async function addEventToGoogleCalendar(
  callerEmail,
  eventName,
  projectType,
  start,
  end
) {
  if (!auth) {
    auth = await authorize();
  }

  if (!calendar) {
    calendar = google.calendar({ version: "v3", auth });
  }

  console.log("auth", auth);

  const event = {
    summary: eventName,
    description: `Meeting with Cheetah's customer support for a ${projectType} project.`,
    start: {
      dateTime: start,
      timeZone: "America/Los_Angeles",
    },
    end: {
      dateTime: end,
      timeZone: "America/Los_Angeles",
    },
    // attendees: [{ email: callerEmail }],
    attendees: [{ email: callerEmail }],
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
      calendarId: "hammadfarooq233@gmail.com",
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
      // console.log("Event created", event);
    }
  );
}

module.exports = { addEventToGoogleCalendar };
