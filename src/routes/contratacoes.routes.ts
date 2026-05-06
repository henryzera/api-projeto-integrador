import { Router, Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';

import { getMongoCollection } from '../database/mongo';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const collection = await getMongoCollection();

    const [total, data] = await Promise.all([
      collection.countDocuments(),
      collection.find({}).skip(skip).limit(limit).toArray()
    ]);

    return res.status(200).json({
      total,
      limit,
      skip,
      data
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documentId = req.params.id;

    if (typeof documentId !== 'string' || !ObjectId.isValid(documentId)) {
      return res.status(400).json({ message: 'Invalid document id' });
    }

    const collection = await getMongoCollection();
    const document = await collection.findOne({
      _id: new ObjectId(documentId)
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    return res.status(200).json(document);
  } catch (error) {
    return next(error);
  }
});

export default router;
