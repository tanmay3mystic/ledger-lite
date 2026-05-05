import axios from "axios";
import FormData from "form-data";
import { v4 as uuid } from "uuid";
import { Transaction } from "../types/transaction";

const PARSER_URL = process.env.PARSER_URL || "http://localhost:8001";

export async function parseFiles(
  files: Express.Multer.File[]
): Promise<Transaction[]> {
  const allTransactions: Transaction[] = [];

  // Parse files concurrently
  await Promise.all(
    files.map(async (file) => {
      const form = new FormData();
      form.append("file", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const { data } = await axios.post<{ transactions: Omit<Transaction, "id">[] }>(
        `${PARSER_URL}/parse`,
        form,
        { headers: form.getHeaders(), timeout: 30_000 }
      );

      const tagged = data.transactions.map((t) => ({
        ...t,
        id: uuid(),
        account: t.account || file.originalname,
      }));

      allTransactions.push(...tagged);
    })
  );

  // Sort by date ascending
  return allTransactions.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
