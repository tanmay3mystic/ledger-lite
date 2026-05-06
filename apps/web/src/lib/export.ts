import * as XLSX from "xlsx";
import { Transaction } from "@/types/transaction";
import { downloadBlob } from "@/lib/utils";

export function exportToExcel(transactions: Transaction[], filename: string): void {
  const rows = transactions.map((t) => ({
    Date: t.date,
    Description: t.description,
    Amount: t.amount,
    Type: t.type,
    Category: t.category,
    Reference: t.reference,
    Account: t.account,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 45 },
    { wch: 14 },
    { wch: 8 },
    { wch: 16 },
    { wch: 22 },
    { wch: 28 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  downloadBlob(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename
  );
}
