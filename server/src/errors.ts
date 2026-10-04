export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: Record<string, unknown>) => new HttpError(400, message, details);
export const notFound = (what = 'Not found') => new HttpError(404, what);
export const forbidden = (message = 'Forbidden') => new HttpError(403, message);
