const moment = require("moment");
const {
  addEventToGoogleCalendar,
} = require("../../integrations/googleCalendar");
const { getAvailableTimeSlots } = require("../../integrations/calendly");
const SubscriptionService = require("../../services/subscription.service");
const { MEETING_FEATURE_ID } = require("../../utils/constants");

const { SubscriptionFeature } = require("../../../models");

async function checkSlotAvailability(month, date, hour, businessId) {
  let convertedDate = constructDate(month, date, hour);
  convertedDate = handleTimeZoneDifference(convertedDate);

  return await getAvailableTimeSlots(convertedDate, false, businessId);
}

async function getNextThreeSlots(month, date, hour, businessId) {
  hour = parseInt(hour) + 1;

  let convertedDate = constructDate(month, date, hour);
  convertedDate = handleTimeZoneDifference(convertedDate);

  const response = await getAvailableTimeSlots(convertedDate, true, businessId);
  return response;
}

async function getSlotsForNextDate(month, date, businessId) {
  let convertedDate = constructDate(month, date, 0);
  convertedDate = handleTimeZoneDifference(convertedDate);

  return await getAvailableTimeSlots(convertedDate, false, businessId);
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

function handleTimeZoneDifference(date) {
  const hoursDifference = Math.abs(date?.getTimezoneOffset()) / 60;

  if (hoursDifference === 0) {
    date = moment(convertedDate).subtract(5, "hours").toDate();
  }

  return date;
}

async function scheduleMeeting(
  month,
  date,
  hour,
  meetingDescription,
  customerEmail,
  businessId
) {
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

  await addEventToGoogleCalendar(
    businessId,
    customerEmail,
    meetingDescription,
    meetingStartTime.toISOString(),
    meetingEndTime.toISOString()
  );

  const subscriptionFeature = await SubscriptionFeature.findOne({
    where: {
      featureId: MEETING_FEATURE_ID,
      businessId,
    },
    raw: true,
  });

  if (
    subscriptionFeature.usedQuantity &&
    typeof parseInt(subscriptionFeature.usedQuantity) === "number"
  ) {
    await SubscriptionService.updateFeatureUsage(
      MEETING_FEATURE_ID,
      businessId,
      1
    );
  }

  return `Meeting has been scheduled.`;
}

module.exports = {
  getNextThreeSlots,
  getSlotsForNextDate,
  checkSlotAvailability,
  scheduleMeeting,
};
