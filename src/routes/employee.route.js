const router = require("express").Router();
const User = require("../models/user.model");

const { z } = require("zod");
const Employee = require("../models/employee.model");

const addEmployeeValidationSchema = z.object({
  name: z.string(),
  phoneNumber: z.string(),
  userId: z.number(),
});

const updateEmployeeValidationSchema = z.object({
  name: z.string(),
  phoneNumber: z.string(),
  employeeId: z.number(),
});

router.post("/", async (req, res) => {
  try {
    const { success, error } = await addEmployeeValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name, phoneNumber, userId } = req.body;

    let user = await User.findOne({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user id." });
    }

    let employee = await Employee.create({
      name,
      phoneNumber,
      userId,
    });

    res.status(201).json({ success: true, data: employee.toJSON() });
  } catch (error) {
    console.error("Error adding employee:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await Employee.destroy({
      where: {
        id: req.params.id,
      },
    });

    res.status(204).json({ success: true });
  } catch (error) {
    console.error("Error deleting employee", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

router.put("/", async (req, res) => {
  try {
    const { success, error } = await updateEmployeeValidationSchema.safeParseAsync(
      req.body
    );

    if (!success) {
      return res
        .status(400)
        .json({ success: false, message: error.errors[0].message });
    }

    const { name, phoneNumber, employeeId } = req.body;

    await Employee.update(
      {
        name,
        phoneNumber,
      },
      {
        where: {
          id: employeeId,
        },
      }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error deleting employee", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
