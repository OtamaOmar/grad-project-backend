import { rateLimit } from "express-rate-limit";

// Slows down password guessing: at most 20 auth requests per IP every 15 minutes.
// Counts live in memory, so they reset when the server restarts.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // Answers in our normal error shape instead of the library's plain text.
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many attempts. Try again later.",
      },
    });
  },
});
