import { translateApiMessage } from '@/i18n/apiErrors';
import { language } from './i18n';

// What the API says is English: the error carries it in the app's language (the field errors too).
export class ApiError extends Error {
  status: number;
  errors?: { field: string; message: string }[];
  /** What kind of problem it is, the end of its type (class-exists, limit-exceeded...), when the API says. */
  code?: string;

  constructor(status: number, message: string, errors?: { field: string; message: string }[], code?: string) {
    super(translateApiMessage(message, language()));
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors?.map((e) => ({ ...e, message: translateApiMessage(e.message, language()) }));
    this.code = code;
  }
}

/** What to tell the user about a failed call: the API's own message when it answered, else the fallback. */
export const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
