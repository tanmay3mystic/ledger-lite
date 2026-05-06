import dotenv from "dotenv";
dotenv.config({ path: `.env.${process.env.NODE_ENV ?? "development"}` });
import express from "express";
import cors from "cors";
import { uploadRouter } from "./routes/upload";
import { exportRouter } from "./routes/export";

const app = express();
const PORT = process.env.PORT || 4000;

// ALLOWED_ORIGINS is a comma-separated list set per environment.
// Fallback covers local development without a .env file.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      const allowed =
        allowedOrigins.some((o) =>
          o.includes("*")
            ? new RegExp("^" + o.replace("*", ".*") + "$").test(origin)
            : o === origin
        );
      callback(allowed ? null : new Error("CORS: origin not allowed"), allowed);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));

app.use("/api", uploadRouter);
app.use("/api", exportRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`✅  API server running on http://localhost:${PORT}`);
  console.log(`    Parser URL: ${process.env.PARSER_URL || "http://localhost:8001"}`);
});
