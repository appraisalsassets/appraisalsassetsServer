import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI;

/** Reuse connection across Vercel serverless invocations */
const globalCache = globalThis;

if (!globalCache.mongoose) {
  globalCache.mongoose = { conn: null, promise: null };
}

const cached = globalCache.mongoose;

const connectDB = async () => {
  if (!MONGO_URI) {
    throw new Error(
      "MONGO_URI is not set. Add it in Vercel → Project Settings → Environment Variables, then redeploy.",
    );
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGO_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
      })
      .then((instance) => {
        console.log("Database Connected");
        return instance;
      })
      .catch((error) => {
        cached.promise = null;
        console.error("MongoDB connection error:", error.message);
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

export default connectDB;
