const moment = require("moment/moment");
const fetch = require("node-fetch");
const { addEventToGoogleCalendar } = require("./google-calendar");

// let url =
//   "https://api.calendly.com/event_types?user=https%3A%2F%2Fapi.calendly.com%2Fusers%2F1a29130a-36bf-450c-851d-08ce787b9406";

let url =
  "https://api.calendly.com/event_types?user=https://api.calendly.com/users/65559c9d-b8e4-4d3f-84f0-4d06dff4ce37";

// access token calendly - ccript account
// const ACCESS_TOKEN =
//   "eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzAyNDUwOTI2LCJqdGkiOiJiMTIyZDUyMy01NjU2LTQ1NTktOGQwNi0xZDRhZTkxZTA4OTYiLCJ1c2VyX3V1aWQiOiIxYTI5MTMwYS0zNmJmLTQ1MGMtODUxZC0wOGNlNzg3Yjk0MDYifQ.1ZoY6YPliZl4vE2mRilPnXbpea2YA66XQpakgq7aFVOzj2u9GYM47owmLuh7zHVprKu2CB8zWtTz2L6QMq1cJQ";

const ACCESS_TOKEN =
  "eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzAyNDYxNDE5LCJqdGkiOiJiNDAxNThhMS0zN2ZhLTQ3NjUtODc1My01MmNhMDA3ZDJmNmQiLCJ1c2VyX3V1aWQiOiI2NTU1OWM5ZC1iOGU0LTRkM2YtODRmMC00ZDA2ZGZmNGNlMzcifQ.spTXAbkewi_FUt1h7g7xI4xLhPligbvb2Zkxqo4P8tjIzr5np0Zb1OUHNT7ZTSoa6ctag4Ffk5JLaGdh3JpeFw";

async function getAvailableTimeSlots(currentDate, email) {
  // let currentDate = new Date();

  // const timeZoneOffset = 5 * 60; // 5 hours in minutes
  // currentDate = new Date(currentDate.getTime() + timeZoneOffset * 60000);

  // console.log("currentDate", currentDate?.toString());

  const hoursDifference = Math.abs(currentDate?.getTimezoneOffset()) / 60;

  console.log("timezone difference", currentDate?.getTimezoneOffset());
  console.log(
    "current time",
    moment(currentDate).subtract(5, "hours").format("hh:mm a")
  );

  // return "done";

  // currentDate = new Date(currentDate.setDate(new Date().getDate() + 1));

  const newDate = new Date();

  const isToday =
    newDate.getFullYear() === currentDate.getFullYear() &&
    newDate.getMonth() === currentDate.getMonth() &&
    newDate.getDate() === currentDate.getDate();

  // if (!isToday) {
  //   console.log("isToday", isToday);

  //   currentDate.setHours(1, 59, 59, 999); // For calendly time zone difference of 5 hours. This means 7am.
  // }

  const startTime = currentDate.toString();
  // const startTime = moment(currentDate)
  //   .subtract(5, "hours")
  //   .toDate()
  //   .toString();

  console.log(moment(currentDate).format("hh:mm a"));

  currentDate.setHours(24, 59, 59, 999);
  const endTime = currentDate.toString();

  let options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  };

  let response = await fetch(url, options);
  let data = await response.json();

  const eventUri = data.collection[0].uri;

  response = await fetch(
    `https://api.calendly.com/event_type_available_times?event_type=${eventUri}&start_time=${startTime}&end_time=${endTime}`,
    options
  );

  data = await response.json();
  console.log("data", data);

  if (data?.collection?.length < 1) {
    return getAvailableTimeSlots(
      new Date(currentDate.setDate(new Date().getDate() + 1))
    );
  }

  data.collection?.forEach((item) => {
    const time = new Date(item.start_time);

    const formattedTime = moment(time).format("hh:mm a");
    console.log("slot", formattedTime);
  });

  const time = new Date(data.collection[0].start_time);
  const formattedTime = moment(time).format("hh:mm a");

  //   await getCalendarEvents();

  let meetingStartTime = moment(new Date(data.collection[0].start_time))
    .subtract(hoursDifference, "hours")
    .toDate();

  let meetingEndTime = new Date(
    new Date(meetingStartTime).setTime(
      meetingStartTime.getTime() + 30 * 60 * 1000
    )
  );

  console.log(moment(meetingStartTime).format("hh:mm a"));
  console.log(moment(meetingEndTime).format("hh:mm a"));
  console.log(moment(meetingEndTime).format("dddd"));

  // return;

  await addEventToGoogleCalendar(
    // email,
    "hammad@ccript.com",
    "Cheetah AI",
    meetingStartTime.toISOString(),
    meetingEndTime.toISOString()
  );

  return {
    day: moment(meetingEndTime).format("dddd"),
    time: moment(meetingStartTime).format("hh:mm a"),
  };

  return formattedTime;
}

module.exports = { getAvailableTimeSlots };
