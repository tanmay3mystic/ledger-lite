"use client";

import { useMutation } from "@tanstack/react-query";
import { exportTransactions } from "@/lib/api";
import { useTransactionStore } from "@/store/transactionStore";
import { downloadBlob, formatCurrency } from "@/lib/utils";
import { TransactionTable } from "./TransactionTable";
import { useState } from "react";

export function TableScreen() {
  const { transactions, editedIds, uploadedFileNames } = useTransactionStore();
  const [exported, setExported] = useState(false);

  const exportMutation = useMutation({
    mutationFn: () => exportTransactions(transactions),
    onSuccess: (blob) => {
      downloadBlob(blob, "transactions-tally.xlsx");
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    },
  });

  const totalCredit = transactions
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);
  const totalDebit = transactions
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {transactions.length} transactions
            </p>
            <p className="text-xs text-gray-400">
              {uploadedFileNames.join(", ")}
            </p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <SummaryBadge
            label="Total Credit"
            value={formatCurrency(totalCredit)}
            color="green"
          />
          <SummaryBadge
            label="Total Debit"
            value={formatCurrency(totalDebit)}
            color="red"
          />
          {editedIds.size > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {editedIds.size} edited
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending || transactions.length === 0}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm"
          >
            {exportMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : exported ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Downloaded!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Clean Excel
              </>
            )}
          </button>
        </div>
      </div>

      {exportMutation.isError && (
        <div className="bg-red-50 border-b border-red-100 px-6 py-2 text-sm text-red-600">
          Export failed. Make sure the API server is running.
        </div>
      )}

      {/* Table */}
      <TransactionTable />
    </div>
  );
}

function SummaryBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "red";
}) {
  return (
    <div className="text-xs">
      <span className="text-gray-400">{label}: </span>
      <span
        className={
          color === "green" ? "text-green-600 font-semibold" : "text-red-500 font-semibold"
        }
      >
        {value}
      </span>
    </div>
  );
}
