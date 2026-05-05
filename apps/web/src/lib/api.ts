import axios from "axios";
import { Transaction } from "@/types/transaction";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
});

export async function uploadFiles(files: File[]): Promise<Transaction[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));

  const { data } = await api.post<{ transactions: Transaction[] }>(
    "/api/upload",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data.transactions;
}

export async function exportTransactions(
  transactions: Transaction[]
): Promise<Blob> {
  const { data } = await api.post(
    "/api/export",
    { transactions },
    { responseType: "blob" }
  );
  return data;
}
