import 'dotenv/config';

import { Collection, Db, Document, MongoClient, ServerApiVersion } from 'mongodb';

let client: MongoClient | null = null;
let database: Db | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }

  return value;
}

export async function connectMongo(): Promise<Db> {
  if (database) {
    return database;
  }

  const uri = getRequiredEnv('MONGO_URI');
  const dbName = getRequiredEnv('MONGO_DB_NAME');

  const mongoClient = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });

  await mongoClient.connect();

  client = mongoClient;
  database = mongoClient.db(dbName);

  return database;
}

export async function getMongoCollection<TSchema extends Document = Document>(
  collectionName = process.env.MONGO_COLLECTION
): Promise<Collection<TSchema>> {
  const db = await connectMongo();
  const name = collectionName || getRequiredEnv('MONGO_COLLECTION');

  return db.collection<TSchema>(name);
}

export async function closeMongo(): Promise<void> {
  if (!client) {
    return;
  }

  await client.close();
  client = null;
  database = null;
}
