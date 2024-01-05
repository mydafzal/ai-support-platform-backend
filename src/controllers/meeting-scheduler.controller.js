const moment = require("moment");
const {
  getAvailableTimeSlots,
  addEventToGoogleCalendar,
} = require("./googleCalendar.controller");

async function checkSlotAvailability(assistantMessage, callData) {
  const {
    oauthCredentials: { accessToken, refreshToken, expiryDate },
    customerEmail: calendarId,
    meetingEvent,
  } = callData;

  const { month, date, hour } = extractArguments(assistantMessage);

  let convertedDate = constructDate(month, date, hour);
  convertedDate = handleTimeZoneDifference(convertedDate);

  const day = moment(convertedDate).format("dddd");

  if (
    !meetingEvent.availableDays.includes(day) ||
    parseInt(hour) < meetingEvent.availabilityStartTime ||
    parseInt(hour) > meetingEvent.availabilityEndTime
  ) {
    console.log("cannot schedule meeting outside of working hours");
    return `Cannot schedule meeting at this time. Meetings can only be scheduled between ${meetingEvent.availabilityStartTime}:00 and ${meetingEvent.availabilityEndTime}:00 on ${meetingEvent.availableDays}`;
  }

  const slots = await getAvailableTimeSlots(
    accessToken,
    refreshToken,
    expiryDate,
    calendarId,
    convertedDate,
    meetingEvent.availabilityEndTime
  );

  console.log("getAvailableTimeSlots - response", slots);
  return slots;
}

async function getNextThreeSlots(assistantMessage, callData) {
  console.log("get next three slots -----called....");
  console.log("calldata", callData);

  const {
    oauthCredentials: { accessToken, refreshToken, expiryDate },
    customerEmail: calendarId,
    meetingEvent,
  } = callData;

  let { month, date, hour } = extractArguments(assistantMessage);

  console.log("args", month, date, hour);

  hour = parseInt(hour) + 1;
  let convertedDate = constructDate(month, date, hour);
  convertedDate = handleTimeZoneDifference(convertedDate);

  console.log("getting slots now................");

  const response = await getAvailableTimeSlots(
    accessToken,
    refreshToken,
    expiryDate,
    calendarId,
    convertedDate,
    meetingEvent.availabilityEndTime,
    true
  );

  console.log("getNextThreeSlots - response", response);
  return response;
}

async function getSlotsForNextDate(assistantMessage, callData) {
  const {
    oauthCredentials: { accessToken, refreshToken, expiryDate },
    customerEmail: calendarId,
    meetingEvent,
  } = callData;

  let { month, date } = extractArguments(assistantMessage);

  let convertedDate = constructDate(
    month,
    date,
    meetingEvent.availabilityStartTime
  );
  convertedDate = handleTimeZoneDifference(convertedDate);

  const slots = await getAvailableTimeSlots(
    accessToken,
    refreshToken,
    expiryDate,
    calendarId,
    convertedDate,
    meetingEvent.availabilityEndTime,
    true
  );

  console.log("getSlotsForNextDate - response", slots);
  return slots;
}

function constructDate(month, date, hour) {
  const monthMap = {
    January: 0,
    February: 1,
    March: 2,
    April: 3,
    May: 4,
    June: 5,
    July: 6,
    August: 7,
    September: 8,
    October: 9,
    November: 10,
    December: 11,
  };

  date = parseInt(date);
  // hour = hour ? parseInt(hour) - 1 : null;

  const convertedDate = new Date();

  convertedDate.setFullYear(new Date().getFullYear());
  convertedDate.setMonth(monthMap[month]);
  convertedDate.setDate(date);

  if (hour || hour === 0) {
    // convertedDate.setHours(hour, 59, 59, 59);
    convertedDate.setHours(hour, 0, 0, 0);
  }

  console.log("convertedDate", convertedDate, convertedDate.toString());

  return convertedDate;
}

function extractArguments(assistantMessage) {
  return JSON.parse(assistantMessage?.tool_calls?.[0].function.arguments);
}

function handleTimeZoneDifference(date) {
  const hoursDifference = Math.abs(date?.getTimezoneOffset()) / 60;

  if (hoursDifference === 0) {
    date = moment(convertedDate).subtract(5, "hours").toDate();
  }

  return date;
}

async function scheduleMeeting(assistantMessage, callData) {
  console.log("schedule meeting called.....");

  const {
    oauthCredentials: { accessToken, refreshToken, expiryDate },
    customerEmail: calendarId,
    meetingEvent,
    userEmail,
  } = callData;

  console.log("call data", callData);
  console.log("assistant Message", assistantMessage?.tool_calls?.[0].function);

  const extractedArgs = extractArguments(assistantMessage);
  console.log("extractedArgs", extractedArgs);

  const { month, date, hour, projectType } = extractedArgs;

  console.log("args", month, date, hour, projectType);

  const convertedDate = constructDate(month, date, hour);

  const timezoneDifferenceInHours =
    Math.abs(convertedDate?.getTimezoneOffset()) / 60;

  // const meetingStartTime =
  //   timezoneDifferenceInHours !== 0
  //     ? moment(convertedDate).add(5, "hours").toDate()
  //     : moment(convertedDate)
  //         .subtract(timezoneDifferenceInHours, "hours")
  //         .toDate();

  let meetingStartTime =
    timezoneDifferenceInHours === 0
      ? moment(convertedDate).subtract(5, "hours").toDate()
      : convertedDate;

  meetingStartTime = moment(meetingStartTime).toDate();

  let meetingEndTime = new Date(
    new Date(meetingStartTime).setTime(
      meetingStartTime.getTime() + 60 * 60 * 1000
    )
  );

  console.log("meetingStartTime", moment(meetingStartTime).format("hh:mm a"));
  console.log("meetingEndTime", moment(meetingEndTime).format("hh:mm a"));
  console.log("format(dddd)", moment(meetingEndTime).format("dddd"));

  await addEventToGoogleCalendar(
    accessToken,
    refreshToken,
    expiryDate,
    calendarId,
    userEmail,
    meetingEvent.name,
    meetingEvent.description,
    meetingStartTime.toISOString(),
    meetingEndTime.toISOString()
  );

  return `Meeting has been scheduled.`;
}

module.exports = {
  getNextThreeSlots,
  getSlotsForNextDate,
  checkSlotAvailability,
  scheduleMeeting,
};
