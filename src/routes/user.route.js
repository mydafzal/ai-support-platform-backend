const router = require("express").Router();
const User = require("../models/user.model");

router.post("/", async (req, res) => {
  try {
    const { name, email } = req.body;
    console.log("add user", req.body);

    let user = await User.findOne({
      where: {
        email,
      },
    });

    if (user?.toJSON()?.email) {
      return res.status(400).json({ message: "Email already exists." });
    }

    user = await User.create({
      name,
      email,
      phoneNumber,
      callerId,
      customerId,
    });

    res.status(201).json(user);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByPk(userId);
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
