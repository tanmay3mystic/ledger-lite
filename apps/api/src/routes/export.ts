import { Router, Request, Response } from "express";
import { buildExcel } from "../services/excelBuilder";
import { Transaction } from "../types/transaction";

export const exportRouter = Router();

exportRouter.post("/export", async (req: Request, res: Response) => {
  try {
    const { transactions } = req.body as { transactions: Transaction[] };
    if (!transactions || transactions.length === 0) {
      res.status(400).json({ error: "No transactions to export" });
      return;
    }

    const buffer = await buildExcel(transactions);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="transactions-tally.xlsx"`
    );
    res.send(buffer);
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});
