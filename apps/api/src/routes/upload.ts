import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { parseFiles } from "../services/parserClient";

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter(_req, file, cb) {
    const allowed = [".csv", ".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  },
});

export const uploadRouter = Router();

uploadRouter.post(
  "/upload",
  upload.array("files", 10),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: "No files uploaded" });
        return;
      }

      const transactions = await parseFiles(files);
      res.json({ transactions, count: transactions.length });
    } catch (err) {
      console.error("Upload error:", err);
      const message = err instanceof Error ? err.message : "Parse failed";
      res.status(500).json({ error: message });
    }
  }
);
