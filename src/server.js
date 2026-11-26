import { createApp } from "./app.js";
import { env } from "./config/env.js";

// Starts the API (npm start / npm run dev).
createApp().listen(env.port, () => {
  console.log(`ACOPS API listening on http://localhost:${env.port}`);
});
