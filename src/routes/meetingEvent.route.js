const router = require("express").Router();
const MeetingEvent = require("../../models/meetingEvent");

router.post("/", async (req, res) => {
  try {
    const {
      name,
      durationInMinutes,
      description,
      customerId,
      availableDays,
      availabilityStartTime,
      availabilityEndTime,
    } = req.body;

    const meetingEvent = await MeetingEvent.create({
      name,
      durationInMinutes,
      description,
      customerId,
      availableDays,
      availabilityStartTime,
      availabilityEndTime,
    });

    res.status(201).json(meetingEvent);
  } catch (error) {
    console.error("Error adding meetingEvent:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;

    let meetingEvent = await MeetingEvent.findOne({
      where: {
        customerId,
      },
    });

    res.status(200).json(meetingEvent);
  } catch (error) {
    console.error("Error fetching meetingEvent:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
