import { ObjectId } from 'mongodb';

import { env } from '../config/env';
import { getMongoCollection } from '../database/mongo';
import type { AlertRecord, AlertStatus, AlertWithId } from '../models/alert.model';

async function getAlertsCollection() {
  return getMongoCollection<AlertRecord>(env.MONGO_ALERTS_COLLECTION);
}

export async function ensureAlertIndexes(): Promise<void> {
  const alerts = await getAlertsCollection();

  await Promise.all([
    alerts.createIndex({ userId: 1, sourceKey: 1 }, { unique: true }),
    alerts.createIndex({ userId: 1, status: 1, date: 1 }),
    alerts.createIndex({ userId: 1, priority: 1, date: 1 })
  ]);
}

export async function upsertAlertBySourceKey(alert: AlertRecord): Promise<void> {
  const alerts = await getAlertsCollection();

  await alerts.updateOne(
    {
      sourceKey: alert.sourceKey,
      userId: alert.userId
    },
    {
      $set: {
        date: alert.date,
        description: alert.description,
        kind: alert.kind,
        priority: alert.priority,
        relatedId: alert.relatedId ?? null,
        relatedType: alert.relatedType ?? null,
        title: alert.title,
        updatedAt: alert.updatedAt
      },
      $setOnInsert: {
        createdAt: alert.createdAt,
        status: alert.status
      }
    },
    {
      upsert: true
    }
  );
}

export async function findAlerts(filter: Record<string, unknown>): Promise<AlertWithId[]> {
  const alerts = await getAlertsCollection();

  return alerts.find(filter).sort({ priority: 1, date: 1, createdAt: -1 }).toArray();
}

export async function updateAlertStatus(
  userId: ObjectId,
  id: string,
  status: AlertStatus
): Promise<AlertWithId | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const alerts = await getAlertsCollection();

  return alerts.findOneAndUpdate(
    {
      _id: new ObjectId(id),
      userId
    },
    {
      $set: {
        status,
        updatedAt: new Date()
      }
    },
    {
      returnDocument: 'after'
    }
  );
}
