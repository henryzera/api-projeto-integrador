import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

type RequestSchemas = {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
};

export function validateRequest(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }

    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as Request['params'];
    }

    if (schemas.query) {
      req.query = schemas.query.parse(req.query) as Request['query'];
    }

    return next();
  };
}
