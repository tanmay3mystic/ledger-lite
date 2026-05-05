import express from "express";
import cors from "cors";
import { uploadRouter } from "./routes/upload";
import { exportRouter } from "./routes/export";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: ["http://localhost:3000", "https://*.vercel.app"],
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
