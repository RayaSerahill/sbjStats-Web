import { MongoClient, type MongoClientOptions } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Missing MONGODB_URI in ..env.local");

const options: MongoClientOptions = {
    appName: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "nextjs-app",
    maxIdleTimeMS: 5000,
};

const client = new MongoClient(uri, options);
attachDatabasePool(client);

const globalForMongo = globalThis as unknown as {
    _mongoClientPromise?: Promise<MongoClient>;
};

export const clientPromise =
    globalForMongo._mongoClientPromise ?? client.connect();

if (process.env.NODE_ENV !== "production") {
    globalForMongo._mongoClientPromise = clientPromise;
}

export default clientPromise;
