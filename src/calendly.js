const moment = require("moment/moment");
const fetch = require("node-fetch");

let url =
  "https://api.calendly.com/event_types?user=https://api.calendly.com/users/65559c9d-b8e4-4d3f-84f0-4d06dff4ce37";

const ACCESS_TOKEN =
  "eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzAyNDYxNDE5LCJqdGkiOiJiNDAxNThhMS0zN2ZhLTQ3NjUtODc1My01MmNhMDA3ZDJmNmQiLCJ1c2VyX3V1aWQiOiI2NTU1OWM5ZC1iOGU0LTRkM2YtODRmMC00ZDA2ZGZmNGNlMzcifQ.spTXAbkewi_FUt1h7g7xI4xLhPligbvb2Zkxqo4P8tjIzr5np0Zb1OUHNT7ZTSoa6ctag4Ffk5JLaGdh3JpeFw";

async function getAvailableTimeSlots(
  requestedDate,
  email,
  nextThreeSlots = false
) {
  const requestedSlot = `${moment(requestedDate).format("HH")}:00`;

  const hoursDifference = Math.abs(requestedDate?.getTimezoneOffset()) / 60;

  console.log("timezone difference", requestedDate?.getTimezoneOffset());
  console.log(
    "current time",
    moment(requestedDate).subtract(5, "hours").format("hh:mm a")
  );

  const startTime =
    hoursDifference === 0
      ? moment(requestedDate).add(5, "hours").toDate().toString()
      : // : moment(requestedDate).subtract(5, "hours").toDate().toString();
        requestedDate.toString();

  console.log(moment(requestedDate).format("hh:mm a"));

  requestedDate.setHours(23, 59, 59, 999);
  const endTime = requestedDate.toString();

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

  console.log("eventUri", eventUri);

  response = await fetch(
    `https://api.calendly.com/event_type_available_times?event_type=${eventUri}&start_time=${startTime}&end_time=${endTime}`,
    options
  );

  data = await response.json();
  // console.log("data", data);

  // if (data?.collection?.length < 1) {
  //   return getAvailableTimeSlots(
  //     new Date(requestedDate.setDate(new Date().getDate() + 1))
  //   );
  // }

  // data.collection?.forEach((item) => {
  //   const time = new Date(item.start_time);

  //   const formattedTime = moment(time).format("HH:mm");
  //   console.log("slot", formattedTime);
  // });

  const slots = data.collection?.map((item) => {
    let time = new Date(item.start_time);

    // if (hoursDifference !== 0) {
    //   time = moment(time).subtract(5, "hours").toDate();
    // }
    time = moment(time).subtract(5, "hours").toDate();

    const formattedTime = moment(time).format("HH:mm");

    return formattedTime;
  });

  console.log("slots", slots);

  if (nextThreeSlots === true) {
    let nextSlots = [];

    for (let i = 0; i < slots.length; i++) {
      if (slots[i] > requestedSlot) {
        nextSlots.push(slots[i]);

        if (nextSlots.length === 3) {
          break;
        }
      }
    }

    return `User refused the previous available slot you communicated to the user. So here are next available slots: ${nextSlots}`;
  }

  const actualRequestedSlot = `${parseInt(requestedSlot.split(":")[0]) + 1}:00`;

  console.log("requestedSlot", requestedSlot);
  console.log("actualRequestedSlot", actualRequestedSlot);

  if (!slots || slots?.length === 0) {
    return "No slots left for the given date.";
  } else if (slots.includes(actualRequestedSlot)) {
    return `Slot available: ${actualRequestedSlot}`;
  } else {
    let nextSlot;

    for (let i = 0; i < slots.length; i++) {
      if (slots[i] > actualRequestedSlot) {
        nextSlot = slots[i];
        break;
      }
    }

    return `Slot not available. Next available slot is ${nextSlot}`;
  }
}

module.exports = { getAvailableTimeSlots };
