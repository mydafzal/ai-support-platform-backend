const { DataTypes } = require("sequelize");
const { sequelize } = require("../loaders/db");
const Business = require("./business.model");

const MeetingEvent = sequelize.define(
  "MeetingEvent",
  {
    durationInMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    availableDays: {
      type: DataTypes.ARRAY(
        DataTypes.ENUM(
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday"
        )
      ),
      allowNull: false,
    },
    availabilityStartTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    availabilityEndTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {}
);

MeetingEvent.belongsTo(Business, { foreignKey: "businessId" });
// MeetingEvent.sync({ force: true });

module.exports = MeetingEvent;
