import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    rollNo: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      trim: true,
    },
    branch: {
      type: String,
      required: [true, 'Branch is required'],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [1, 'Year must be between 1 and 4'],
      max: [4, 'Year must be between 1 and 4'],
    },
    cgpa: {
      type: Number,
      required: [true, 'CGPA is required'],
      min: [0, 'CGPA must be between 0 and 10'],
      max: [10, 'CGPA must be between 0 and 10'],
    },
    skills: {
      type: [String],
      default: [],
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },
    placementStatus: {
      type: String,
      enum: ['Placed', 'Not Placed'],
      default: 'Not Placed',
    },
    resume: {
      filename: {
        type: String,
        default: null,
      },
      storedFilename: {
        type: String,
        default: null,
      },
      storageProvider: {
        type: String,
        enum: ['local', 'supabase'],
        default: 'local',
      },
      storagePath: {
        type: String,
        default: null,
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
      size: {
        type: Number,
        default: 0,
      },
      contentType: {
        type: String,
        default: 'application/pdf',
      },
    },
  },
  {
    timestamps: true,
  }
);

studentSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: 'objectId' } },
  }
);
studentSchema.index({ name: 1 });
studentSchema.index({ branch: 1, year: 1, placementStatus: 1 });

export default mongoose.model('Student', studentSchema);
