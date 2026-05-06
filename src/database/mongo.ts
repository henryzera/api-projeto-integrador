import { Collection, Db, Document, MongoClient, ServerApiVersion } from 'mongodb';

import { env } from '../config/env';

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (database) {
    return database;
  }

  const mongoClient = new MongoClient(env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });

  await mongoClient.connect();

  client = mongoClient;
  database = mongoClient.db(env.MONGO_DB_NAME);

  return database;
}

export async function getMongoCollection<TSchema extends Document = Document>(
  collectionName = env.MONGO_COLLECTION
): Promise<Collection<TSchema>> {
  const db = await connectMongo();

  return db.collection<TSchema>(collectionName);
}

export async function closeMongo(): Promise<void> {
  if (!client) {
    return;
  }

  await client.close();
  client = null;
  database = null;
}
