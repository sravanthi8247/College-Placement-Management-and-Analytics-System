
import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    packageOffered: {
      type: Number,
      required: true,
      min: 0,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    jobRole: {
      type: String,
      required: true,
      trim: true,
    },

    eligibilityCGPA: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },

    eligibleBranches: {
      type: [String],
      default: [],
    },

    eligibleYears: {
      type: [String],
      default: [],
    },

    requiredSkills: {
      type: [String],
      default: [],
    },

    driveDate: {
      type: Date,
      required: true,
    },

    applicationDeadline: {
      type: Date,
      default: null,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    driveStatus: {
      type: String,
      enum: ["Open", "Closed", "Completed"],
      default: "Open",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Company", companySchema);
