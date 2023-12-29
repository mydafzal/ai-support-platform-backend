const moment = require("moment");

async function checkSlotAvailability(assistantMessage) {
  const { month, date, hour } = extractArguments(assistantMessage);

  let convertedDate = constructDate(month, date, hour);
  convertedDate = handleTimeZoneDifference(convertedDate);

  const slots = await getAvailableTimeSlots(convertedDate);
  console.log("getAvailableTimeSlots - response", slots);
  return slots;
}

async function getNextThreeSlots(assistantMessage) {
  let { month, date, hour } = extractArguments(assistantMessage);

  hour = parseInt(hour) + 1;
  let convertedDate = constructDate(month, date, hour);
  convertedDate = handleTimeZoneDifference(convertedDate);

  const slots = await getAvailableTimeSlots(convertedDate, "", true);
  console.log("getNextThreeSlots - response", slots);
  return slots;
}

async function getSlotsForNextDate(assistantMessage) {
  let { month, date } = extractArguments(assistantMessage);

  let convertedDate = constructDate(month, date);
  convertedDate = handleTimeZoneDifference(convertedDate);

  const slots = await getAvailableTimeSlots(convertedDate, "", true);
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
  hour = hour ? parseInt(hour) - 1 : null;

  const convertedDate = new Date();

  convertedDate.setFullYear(new Date().getFullYear());
  convertedDate.setMonth(monthMap[month]);
  convertedDate.setDate(date);

  if (hour || hour === 0) {
    convertedDate.setHours(hour, 59, 59, 59);
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

async function scheduleMeeting(assistantMessage, request) {
  const { month, date, hour, projectType } = extractArguments(assistantMessage);

  const convertedDate = constructDate(month, date, hour);

  console.log("scheduleMeeting convertedDate", convertedDate.toString());

  const timezoneDifferenceInHours =
    Math.abs(convertedDate?.getTimezoneOffset()) / 60;

  console.log("timezoneDifferenceInHours", timezoneDifferenceInHours);

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

  meetingStartTime = moment(meetingStartTime).add(1, "minute").toDate();

  let meetingEndTime = new Date(
    new Date(meetingStartTime).setTime(
      meetingStartTime.getTime() + 30 * 60 * 1000
    )
  );

  console.log("meetingStartTime", moment(meetingStartTime).format("hh:mm a"));
  console.log("meetingEndTime", moment(meetingEndTime).format("hh:mm a"));
  console.log("format(dddd)", moment(meetingEndTime).format("dddd"));

  const email = await isUserRegistered(request);

  await addEventToGoogleCalendar(
    email,
    "Cheetah AI",
    projectType,
    meetingStartTime.toISOString(),
    meetingEndTime.toISOString()
  );

  return `Meeting has been scheduled.`;
}

module.exports = {
  getNextThreeSlots,
  getSlotsForNextDate,
  checkSlotAvailability,
};
