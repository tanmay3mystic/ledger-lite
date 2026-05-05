"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
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
    onError: () => setView("upload"),
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

        {uploadMutation.isError && (
          <p className="mt-3 text-sm text-red-500 text-center">
            Something went wrong. Make sure the API is running and try again.
          </p>
        )}

        {/* Supported format hint */}
        <div className="mt-8 flex items-start gap-2 text-xs text-gray-400 bg-gray-100 rounded-xl p-4">
          <svg
            className="w-4 h-4 mt-0.5 shrink-0 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Your file is processed locally and never stored. Works with most
            Indian bank CSV exports (SBI, HDFC, ICICI, Axis).
          </span>
        </div>
      </div>
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
