import mongoose, { Schema, Document, Model } from "mongoose";

// Interface for TypeScript
export interface UserI extends Document {
  email: string;
  sourceLanguage: string;
  targetLanguage?: string;
}

// Schema
const UserSchema = new Schema<UserI>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // simpler validation
    },
    sourceLanguage: { type: String, default: "en" },
    targetLanguage: { type: String, default: "zh" },
  },
  { timestamps: true }
);

// Model (avoids recompilation errors in dev)
export const User: Model<UserI> =
  mongoose.models.User || mongoose.model<UserI>("User", UserSchema);
