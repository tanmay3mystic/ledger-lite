"use client";

import { useTransactionStore } from "@/store/transactionStore";
import { UploadScreen } from "@/components/upload/UploadScreen";
import { ProcessingScreen } from "@/components/upload/ProcessingScreen";
import { TableScreen } from "@/components/table/TableScreen";

export default function Home() {
  const view = useTransactionStore((s) => s.view);

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex flex-col">
        {view === "upload" && <UploadScreen />}
        {view === "processing" && <ProcessingScreen />}
        {view === "table" && <TableScreen />}
      </div>
    </main>
  );
}

function Header() {
  const { view, reset } = useTransactionStore();

  return (
    <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between shadow-sm">
      <button
        onClick={reset}
        className="flex items-center gap-2 group"
        title="Back to start"
      >
        <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <span className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
          LedgerLite
        </span>
      </button>

      {view === "table" && (
        <button
          onClick={reset}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Upload new file
        </button>
      )}
    </header>
  );
}
