// /**
//  * @deprecated This file is deprecated and will not be used in the future.
//  * We are now using the SimpleStorage function (brand new from the SDK) instead of MongoDB.
//  */

// import dotenv from "dotenv";
// import mongoose from 'mongoose';

// dotenv.config(); // Load environment variables from .env file

// const MONGO_URL = process.env.MONGO_URL as string;

// export async function connectDB() {
//   try {
//     await mongoose.connect(MONGO_URL, {
//       dbName: "myDatabase", // optional: defaults to "test"
//     });
//     console.log("✅ Connected to MongoDB Atlas with Mongoose");
//   } catch (err) {
//     console.error("❌ Mongoose connection error:", err);
//     throw err;
//   }
// }