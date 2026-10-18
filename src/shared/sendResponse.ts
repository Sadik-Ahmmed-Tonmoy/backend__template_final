import { Response } from 'express';

type Meta = {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
};

type SendResponsePayload<T> = {
  statusCode: number;
  success: boolean;
  message: string;
  meta?: Meta;
  data: T | null | undefined;
};

const sendResponse = <T>(res: Response, payload: SendResponsePayload<T>): void => {
  res.status(payload.statusCode).json({
    success: payload.success,
    message: payload.message,
    ...(payload.meta ? { meta: payload.meta } : {}),
    data: payload.data ?? null,
  });
};

export default sendResponse;