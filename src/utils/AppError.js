// An error a route throws on purpose, carrying the HTTP status and a short code.
// The error handler turns it into { error: { code, message, details? } }.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// 401: nobody is signed in, or the session is no longer valid.
export const unauthenticated = () =>
  new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");

// 403: signed in, but this role may not use the route.
export const forbidden = () =>
  new AppError(403, "FORBIDDEN", "Your role cannot access this resource.");
