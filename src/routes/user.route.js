const router = require("express").Router();
const User = require("../models/user.model");

const bcrypt = require("bcrypt");
const saltRounds = 10;

const { z } = require("zod");

const userValidationSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  externalType: z.enum(["Google", "Apple", ""]).optional(),
  externalId: z.string().optional(),
  name: z.string().optional(),
});

router.post("/", async (req, res) => {
  const { name, email, password, externalId, externalType } = req.body;
  console.log("add user", req.body);

  try {
    const { success, error } = await userValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    let user = await User.findOne({
      where: {
        email,
      },
    });

    if (user?.toJSON()?.email) {
      return res
        .status(400)
        .json({ success: false, message: "Email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    user = await User.create({
      name,
      email,
      password: hashedPassword,
      externalId: externalId || null,
      externalType: externalType || null,
    });

    res.status(201).json({ success: true, data: user.toJSON() });
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
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
