import axios from "axios";
import { Transaction } from "@/types/transaction";

const parserApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_PARSER_URL ?? "http://localhost:8001",
});

export async function uploadFiles(files: File[]): Promise<Transaction[]> {
  const results = await Promise.all(
    files.map(async (file) => {
      const form = new FormData();
      form.append("file", file);

      let data: { transactions: Omit<Transaction, "id">[] };
      try {
        ({ data } = await parserApi.post<{
          transactions: Omit<Transaction, "id">[];
        }>("/parse", form, { timeout: 30_000 }));
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.data) {
          const detail =
            err.response.data.detail ??
            err.response.data.error ??
            err.message;
          throw new Error(`${file.name}: ${detail}`);
        }
        throw err;
      }

      return data.transactions.map((t) => ({
        ...t,
        id: crypto.randomUUID(),
        account: t.account || file.name,
      }));
    })
  );

  return results
    .flat()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
