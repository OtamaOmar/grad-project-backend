import "dotenv/config";

// Settings the API reads from .env. A missing secret stops the server at startup,
// not later on the first login.

const jwtSecret = process.env.JWT_SECRET ?? "";
if (jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET is missing or shorter than 32 characters. Set it in .env (see .env.example).",
  );
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  isProduction: process.env.NODE_ENV === "production",
  // The browser address allowed to call the API with the login cookie (Vite dev server by default).
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  jwtSecret,
};
