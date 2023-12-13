const { google } = require("googleapis");
const key = require("../keyfile.json");

// Set up the JWT client
const jwtClient = new google.auth.JWT(key.client_email, null, key.private_key, [
  "https://www.googleapis.com/auth/calendar",
]);

// Make an API request (example: list upcoming events)
const calendar = google.calendar({ version: "v3", auth: jwtClient });

async function getCalendarEvents() {
  const response = await calendar.events.list({
    // calendarId: "primary",
    calendarId: "hammadfarooq233@gmail.com",
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = response.data.items;

  console.log("data", response.data);

  if (events.length) {
    console.log("Upcoming events:");

    events.forEach((event) => {
      const start = event.start.dateTime || event.start.date;
      console.log(`${start} - ${event.summary}`);
    });
  } else {
    console.log("No upcoming events found.");
  }
}

async function addEventToGoogleCalendar(eventName, start, end) {
  const event = {
    // summary: "Google I/O 2023",
    summary: eventName,
    // location: "800 Howard St., San Francisco, CA 94103",
    description: "Meeting with Cheetah's customer support",
    start: {
      // dateTime: "2023-12-14T09:00:00-07:00",
      dateTime: start,
      timeZone: "America/Los_Angeles",
      // timeZone: "GMT",
    },
    end: {
      // dateTime: "2023-12-14T17:00:00-08:00",
      dateTime: end,
      timeZone: "America/Los_Angeles",
      // timeZone: "GMT",
    },
    // recurrence: ["RRULE:FREQ=DAILY;COUNT=2"],
    // attendees: [{ email: "lpage@example.com" }, { email: "sbrin@example.com" }],
    // attendees: [{ email: "hammad@ccript.com" }],
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 10 },
      ],
    },
  };

  calendar.events.insert(
    {
      calendarId: "hammadfarooq233@gmail.com",
      resource: event,
      sendNotifications: true,
      sendUpdates: "all",
    },
    function (err, event) {
      if (err) {
        console.log(
          "There was an error contacting the Calendar service: " + err
        );
        return;
      }

      console.log("Event created", event);
    }
  );
}

module.exports = { getCalendarEvents, addEventToGoogleCalendar };
