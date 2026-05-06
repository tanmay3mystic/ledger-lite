"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { uploadFiles } from "@/lib/api";
import { useTransactionStore } from "@/store/transactionStore";
import { cn } from "@/lib/utils";

const ACCEPTED = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.ms-excel": [".xls"],
};

export function UploadScreen() {
  const [files, setFiles] = useState<File[]>([]);
  const { setView, setTransactions, setUploadedFileNames } =
    useTransactionStore();

  const uploadMutation = useMutation({
    mutationFn: uploadFiles,
    onMutate: () => setView("processing"),
    onSuccess: (txns) => {
      setTransactions(txns);
      setView("table");
    },
    onError: (err) => {
      setView("upload");
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not process your file. Please try again."
      );
    },
  });

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...accepted.filter((f) => !existing.has(f.name))];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
  });

  const removeFile = (name: string) =>
    setFiles((prev) => prev.filter((f) => f.name !== name));

  const handleUpload = () => {
    setUploadedFileNames(files.map((f) => f.name));
    uploadMutation.mutate(files);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl">
        {/* Hero text */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Reconcile in minutes,{" "}
            <span className="text-brand-600">not hours</span>
          </h1>
          <p className="text-gray-500 text-base">
            Upload your bank statement and get a clean, Tally-ready Excel in
            seconds.
          </p>
        </div>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200",
            isDragActive
              ? "border-brand-500 bg-brand-50 scale-[1.01]"
              : "border-gray-300 bg-white hover:border-brand-400 hover:bg-gray-50"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                isDragActive ? "bg-brand-100" : "bg-gray-100"
              )}
            >
              <svg
                className={cn(
                  "w-7 h-7 transition-colors",
                  isDragActive ? "text-brand-600" : "text-gray-400"
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            {isDragActive ? (
              <p className="text-brand-600 font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="font-medium text-gray-700">
                  Upload your bank statements
                </p>
                <p className="text-sm text-gray-400">
                  Drag & drop CSV or Excel files, or{" "}
                  <span className="text-brand-600 underline underline-offset-2">
                    browse
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Supports .csv, .xlsx, .xls
                </p>
              </>
            )}
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file) => (
              <FileChip
                key={file.name}
                file={file}
                onRemove={() => removeFile(file.name)}
              />
            ))}
          </div>
        )}

        {/* Upload button */}
        {files.length > 0 && (
          <button
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
            className="mt-5 w-full bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
          >
            Parse {files.length} file{files.length > 1 ? "s" : ""}
          </button>
        )}

        {/* FAQ */}
        <div className="mt-8 space-y-1">
          <Faq question="What file formats are supported?">
            CSV (.csv), Excel (.xlsx), and legacy Excel (.xls). Most Indian bank
            statement exports fall into one of these.
          </Faq>

          <Faq question="What columns must the file have?">
            <p className="mb-2">Two columns are <strong>required</strong>:</p>
            <ul className="space-y-1 mb-2">
              <li>
                <span className="font-medium text-gray-700">Date</span>
                {" "}— any of:{" "}
                <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">Date</span>,{" "}
                <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">Txn Date</span>,{" "}
                <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">Transaction Date</span>,{" "}
                <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">Value Date</span>, etc.
              </li>
              <li>
                <span className="font-medium text-gray-700">Description</span>
                {" "}— any of:{" "}
                <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">Narration</span>,{" "}
                <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">Particulars</span>,{" "}
                <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">Description</span>,{" "}
                <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">Remarks</span>, etc.
              </li>
            </ul>
            <p>
              For amounts, either separate{" "}
              <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">Debit</span>{" "}
              /{" "}
              <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">Credit</span>{" "}
              columns or a single{" "}
              <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">Amount</span>{" "}
              column works.
            </p>
          </Faq>

          <Faq question="Why did my file fail to parse?">
            <ul className="space-y-1">
              <li>The column headers don&apos;t match any recognised names above.</li>
              <li>
                The file has many rows of bank metadata before the actual table
                — the parser skips up to 30 header rows automatically, but some
                files exceed this.
              </li>
              <li>The file is password-protected or corrupted.</li>
              <li>
                The{" "}
                <span className="font-mono text-[11px] bg-gray-100 px-1 rounded">.xls</span>{" "}
                file is actually an HTML table saved with an Excel extension
                (common with some bank portals).
              </li>
            </ul>
          </Faq>

          <Faq question="Is my data safe?">
            Your file is parsed entirely within the app — nothing is stored or
            sent to any third party. Once you close the tab, the data is gone.
          </Faq>
        </div>
      </div>
    </div>
  );
}

function Faq({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">{question}</span>
        <svg
          className={cn(
            "w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

function FileChip({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const sizeKb = (file.size / 1024).toFixed(1);
  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-brand-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 truncate max-w-[260px]">
            {file.name}
          </p>
          <p className="text-xs text-gray-400">{sizeKb} KB</p>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="text-gray-300 hover:text-red-400 transition-colors ml-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
