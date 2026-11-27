import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";

// Every error leaves the API in the same shape:
//   { "error": { "code": "SOME_CODE", "message": "Human text", "details": ... } }
// Request bodies, cookies and headers are never logged.

// Writes one error response. `details` is added only when there is something to show.
function send(res, status, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  res.status(status).json({ error });
}

// Answers any path no route matched.
export function notFound(req, res) {
  send(res, 404, "NOT_FOUND", "No route matches this method and path.");
}

// Turns any thrown error into the envelope above. Express knows it is the error
// handler because it takes four arguments, so `next` stays even though it is unused.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return send(res, err.status, err.code, err.message, err.details);
  }

  // Bad input: list each field that failed and why.
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));
    return send(
      res,
      400,
      "VALIDATION_FAILED",
      "The request is not valid.",
      details,
    );
  }

  // Thrown by express.json() before any route runs.
  if (err.type === "entity.too.large") {
    return send(
      res,
      400,
      "PAYLOAD_TOO_LARGE",
      "The request body is larger than 16 KB.",
    );
  }
  if (err.type === "entity.parse.failed") {
    return send(
      res,
      400,
      "INVALID_JSON",
      "The request body is not valid JSON.",
    );
  }

  // A real bug: log the stack for us, tell the client nothing about the cause.
  console.error(`[${req.method} ${req.path}]`, err.stack || err);
  return send(
    res,
    500,
    "INTERNAL_ERROR",
    "Something went wrong on the server.",
  );
}
