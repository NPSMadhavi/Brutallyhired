import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";

/** Errors carry a stable machine code; the client maps it to translated text. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public fields?: Record<string, string[] | undefined>,
  ) {
    super(message ?? code);
  }
}

export const notFound = (what = "resource") => new HttpError(404, `${what}_not_found`);
export const forbidden = () => new HttpError(403, "forbidden");
export const conflict = (code: string) => new HttpError(409, code);

export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new HttpError(422, "validation_failed", undefined, result.error.flatten().fieldErrors);
  return result.data;
}
