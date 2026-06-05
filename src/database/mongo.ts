import { Collection, Db, Document, MongoClient, ServerApiVersion } from 'mongodb';

import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (database) {
    return database;
  }

  for (let attempt = 1; attempt <= env.MONGO_CONNECT_RETRIES; attempt += 1) {
    const mongoClient = createMongoClient();

    try {
      await mongoClient.connect();
      await mongoClient.db(env.MONGO_DB_NAME).command({ ping: 1 });

      client = mongoClient;
      database = mongoClient.db(env.MONGO_DB_NAME);
      logger.info('mongodb_connected', { database: env.MONGO_DB_NAME });

      return database;
    } catch (error) {
      logger.warn('mongodb_connection_failed', {
        attempt,
        error,
        maxAttempts: env.MONGO_CONNECT_RETRIES
      });

      if (attempt === env.MONGO_CONNECT_RETRIES) {
        await mongoClient.close().catch(() => undefined);
        throw error;
      }

      await mongoClient.close().catch(() => undefined);
      await delay(env.MONGO_CONNECT_RETRY_DELAY_MS);
    }
  }

  throw new Error('MongoDB connection failed');
}

function createMongoClient(): MongoClient {
  return new MongoClient(env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  });
}

export async function getMongoCollection<TSchema extends Document = Document>(
  collectionName = env.MONGO_COLLECTION
): Promise<Collection<TSchema>> {
  // Se ja temos conexao ativa, retornamos rapidamente. Caso contrario tentamos
  // (re)conectar uma vez; se falhar, lancamos um erro tratado (503) em vez de
  // derrubar o processo — o boot resiliente segue tentando reconectar em
  // background.
  if (database) {
    return database.collection<TSchema>(collectionName);
  }

  try {
    const db = await connectMongo();

    return db.collection<TSchema>(collectionName);
  } catch (error) {
    logger.warn('mongo_collection_unavailable', { collectionName, error });

    throw new AppError(503, 'Database temporarily unavailable. Please try again shortly.');
  }
}

export async function closeMongo(): Promise<void> {
  if (!client) {
    return;
  }

  await client.close();
  client = null;
  database = null;
}

export async function pingMongo(): Promise<boolean> {
  if (!database) {
    return false;
  }

  try {
    await database.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export function isMongoConnected(): boolean {
  return Boolean(database);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
