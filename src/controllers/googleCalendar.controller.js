const { google } = require("googleapis");
const credentials = require("../../credentials.json");
const moment = require("moment");

const { client_secret, client_id, redirect_uris } = credentials.installed;
const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

async function getAvailableTimeSlots(
  accessToken,
  refreshToken,
  expiryDate,
  calendarId,
  requestedDate,
  endHour,
  nextThreeSlots = false
) {
  const token = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate,
    scope: "https://www.googleapis.com/auth/calendar.events",
    token_type: "Bearer",
  };

  console.log("token", token);
  console.log("requestedDate", moment(requestedDate).format("LTS"));
  console.log("endHour", endHour);

  oauth2Client.setCredentials(token);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const startTime = new Date(requestedDate);

  const endTime = new Date(requestedDate);
  endTime.setHours(endHour, 0, 0, 0);

  const events = await calendar.events.list({
    calendarId,
    timeMin: startTime.toISOString(),
    timeMax: endTime.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  // Extract busy slots
  const busySlots = events.data.items.map((event) => ({
    start: new Date(event.start.dateTime),
    end: new Date(event.end.dateTime),
  }));

  console.log("busySLots", busySlots);

  // Generate available slots (assuming one-hour slots)
  let availableSlots = [];
  let currentSlotStart = new Date(startTime);

  while (currentSlotStart < endTime) {
    const currentSlotEnd = new Date(currentSlotStart);
    currentSlotEnd.setHours(currentSlotStart.getHours() + 1);

    const isSlotFree = busySlots.every(
      (busySlot) =>
        currentSlotEnd <= busySlot.start || currentSlotStart >= busySlot.end
    );

    if (isSlotFree) {
      availableSlots.push({
        start: new Date(currentSlotStart),
        end: new Date(currentSlotEnd),
      });
    }

    currentSlotStart = new Date(currentSlotEnd);
  }

  availableSlots = availableSlots.map((slot) =>
    moment(slot.start).format("HH:mm")
  );

  console.log("available slots", availableSlots);

  const requestedSlot = `${moment(requestedDate).format("HH")}:00`;
  console.log("requestedSlot", requestedSlot);

  if (nextThreeSlots === true) {
    let nextSlots = [];

    for (let i = 0; i < availableSlots.length; i++) {
      console.log("for  loop");
      console.log(("condition", availableSlots[i] > requestedSlot));

      if (availableSlots[i] >= requestedSlot) {
        console.log("if block..");
        nextSlots.push(availableSlots[i]);

        if (nextSlots.length === 3) {
          break;
        }
      }
    }

    console.log("after looop", nextSlots);
    return `User refused the previous available slot you communicated to the user. So here are next available slots: ${nextSlots}`;
  }

  if (!availableSlots || availableSlots?.length === 0) {
    return "No slots left for the given date.";
  } else if (availableSlots.includes(requestedSlot)) {
    return `Slot available: ${requestedSlot}`;
  } else {
    let nextSlot;

    for (let i = 0; i < availableSlots.length; i++) {
      if (availableSlots[i] > requestedSlot) {
        nextSlot = availableSlots[i];
        break;
      }
    }

    return `Slot not available. Next available slot is ${nextSlot}`;
  }
}

async function addEventToGoogleCalendar(
  accessToken,
  refreshToken,
  expiryDate,
  calendarId,
  callerEmail,
  eventName,
  eventDescription,
  start,
  end
) {
  const token = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate,
    scope: "https://www.googleapis.com/auth/calendar.events",
    token_type: "Bearer",
  };

  console.log("token", token);

  oauth2Client.setCredentials(token);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const event = {
    summary: eventName,
    // description: `Meeting with Cheetah's customer support for a ${projectType} project.`,
    description: eventDescription,
    start: {
      dateTime: start,
      timeZone: "America/Los_Angeles",
    },
    end: {
      dateTime: end,
      timeZone: "America/Los_Angeles",
    },
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
      calendarId,
      requestBody: event,
      sendNotifications: true,
      sendUpdates: "all",
      conferenceDataVersion: 1,
    },
    function (err) {
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

module.exports = { getAvailableTimeSlots, addEventToGoogleCalendar };
