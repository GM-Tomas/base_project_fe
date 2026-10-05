export class ApiError extends Error {
  status: number;
  errors?: { field: string; message: string }[];

  constructor(status: number, message: string, errors?: { field: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

/** What to tell the user about a failed call: the API's own message when it answered, else the fallback. */
export const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
