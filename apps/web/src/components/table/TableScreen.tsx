"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { uploadFiles } from "@/lib/api";
import { exportToExcel } from "@/lib/export";
import { useTransactionStore } from "@/store/transactionStore";
import { cn, formatCurrency } from "@/lib/utils";
import { TransactionTable } from "./TransactionTable";
import { Transaction } from "@/types/transaction";

const ACCEPTED = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
};

// ── Filter state ───────────────────────────────────────────────────────────────

export interface Filters {
  description: string;
  reference: string;
  amountGt: string;
  amountLt: string;
  dateFrom: string; // "YYYY-MM-DDTHH:mm"
  dateTo: string;   // "YYYY-MM-DDTHH:mm"
}

export const EMPTY_FILTERS: Filters = {
  description: "",
  reference: "",
  amountGt: "",
  amountLt: "",
  dateFrom: "",
  dateTo: "",
};

// IST is UTC+5:30. Format a Date as "YYYY-MM-DDTHH:mm" in IST for datetime-local inputs.
function toISTLocalString(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 16);
}

// Today at 00:00 IST, expressed as a datetime-local value
export function todayStartIST(): string {
  const now = new Date();
  const istMidnight = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      // subtract IST offset (5h30m) so that UTC midnight = IST midnight
      -5, -30
    )
  );
  return toISTLocalString(istMidnight);
}

function applyFilters(transactions: Transaction[], filters: Filters): Transaction[] {
  let data = transactions;

  if (filters.description) {
    const q = filters.description.toLowerCase();
    data = data.filter((t) => t.description.toLowerCase().includes(q));
  }

  if (filters.reference) {
    const q = filters.reference.toLowerCase();
    data = data.filter((t) => t.reference.toLowerCase().includes(q));
  }

  const gt = parseFloat(filters.amountGt);
  if (!isNaN(gt)) data = data.filter((t) => t.amount > gt);

  const lt = parseFloat(filters.amountLt);
  if (!isNaN(lt)) data = data.filter((t) => t.amount < lt);

  // Date range: compare YYYY-MM-DD strings directly (ISO order is lexicographic)
  if (filters.dateFrom) {
    const from = filters.dateFrom.slice(0, 10); // take YYYY-MM-DD part
    data = data.filter((t) => t.date >= from);
  }
  if (filters.dateTo) {
    const to = filters.dateTo.slice(0, 10);
    data = data.filter((t) => t.date <= to);
  }

  return data;
}

// ── TableScreen ────────────────────────────────────────────────────────────────

export function TableScreen() {
  const { transactions, editedIds, uploadedFileNames } = useTransactionStore();
  const [exported, setExported] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const isFiltered = Object.values(filters).some(Boolean);

  const filteredData = useMemo(
    () => applyFilters(transactions, filters),
    [transactions, filters]
  );

  // Export uses only visible rows when a filter is active
  const exportData = isFiltered ? filteredData : transactions;

  const handleExport = () => {
    try {
      const suffix = isFiltered ? `-filtered-${filteredData.length}` : "";
      exportToExcel(exportData, `transactions-tally${suffix}.xlsx`);
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch {
      toast.error("Export failed. Please try again.");
    }
  };

  const totalCredit = filteredData.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalDebit  = filteredData.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);

  const sortedDates = useMemo(() => transactions.map((t) => t.date).sort(), [transactions]);
  const minDate = sortedDates[0] ?? "";
  const maxDate = sortedDates[sortedDates.length - 1] ?? "";

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {transactions.length} transactions
            </p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {uploadedFileNames.map((name) => (
                <span
                  key={name}
                  title={name}
                  className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded max-w-[140px] sm:max-w-[200px] truncate"
                >
                  <svg className="w-3 h-3 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {name}
                </span>
              ))}
            </div>
          </div>
          <div className="h-6 w-px bg-gray-200 hidden sm:block" />
          <SummaryBadge label="Credit" value={formatCurrency(totalCredit)} color="green" />
          <SummaryBadge label="Debit"  value={formatCurrency(totalDebit)}  color="red" />
          {editedIds.size > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {editedIds.size} edited
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Add files</span>
          </button>

          <ExportButton
            isFiltered={isFiltered}
            filteredCount={filteredData.length}
            isSuccess={exported}
            disabled={exportData.length === 0}
            onClick={handleExport}
          />
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={setFilters} total={transactions.length} visible={filteredData.length} minDate={minDate} maxDate={maxDate} />

      {/* Table — receives pre-filtered data */}
      <TransactionTable data={filteredData} allCount={transactions.length} />

      {showAddModal && <AddFilesModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

// ── Export button ──────────────────────────────────────────────────────────────

function ExportButton({
  isFiltered, filteredCount, isSuccess, disabled, onClick,
}: {
  isFiltered: boolean;
  filteredCount: number;
  isSuccess: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm text-white",
          isFiltered
            ? "bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300"
            : "bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300"
        )}
      >
        {isSuccess ? (
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
            <span className="hidden sm:inline">{isFiltered ? `Export ${filteredCount} filtered rows` : "Download Clean Excel"}</span>
            <span className="sm:hidden">{isFiltered ? `Export ${filteredCount}` : "Export"}</span>
          </>
        )}
      </button>
      {isFiltered && !isSuccess && (
        <p className="text-xs text-amber-600">Active filter — full data not included</p>
      )}
    </div>
  );
}

// ── Filter bar ─────────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  onChange,
  total,
  visible,
  minDate,
  maxDate,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  total: number;
  visible: number;
  minDate: string;
  maxDate: string;
}) {
  const isFiltered = Object.values(filters).some(Boolean);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-2 flex-shrink-0 overflow-x-auto scrollbar-thin">
      {/* Description */}
      <FilterInput
        icon={
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
        placeholder="Search description..."
        value={filters.description}
        onChange={(v) => set({ description: v })}
        width="w-52"
      />

      {/* Reference */}
      <FilterInput
        icon={<span className="text-gray-400 text-xs font-mono">#</span>}
        placeholder="Reference..."
        value={filters.reference}
        onChange={(v) => set({ reference: v })}
        width="w-36"
      />

      <div className="h-5 w-px bg-gray-200" />

      {/* Amount > */}
      <FilterInput
        icon={<span className="text-gray-500 text-xs font-bold">&gt;</span>}
        placeholder="Amount"
        value={filters.amountGt}
        onChange={(v) => set({ amountGt: v })}
        width="w-28"
        inputMode="decimal"
        active={!!filters.amountGt}
      />

      {/* Amount < */}
      <FilterInput
        icon={<span className="text-gray-500 text-xs font-bold">&lt;</span>}
        placeholder="Amount"
        value={filters.amountLt}
        onChange={(v) => set({ amountLt: v })}
        width="w-28"
        inputMode="decimal"
        active={!!filters.amountLt}
      />

      <div className="h-5 w-px bg-gray-200" />

      {/* Date range */}
      <DateRangeFilter filters={filters} set={set} minDate={minDate} maxDate={maxDate} />

      {/* Clear */}
      {isFiltered && (
        <>
          <div className="h-5 w-px bg-gray-200" />
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filters
          </button>
        </>
      )}

      {/* Row count */}
      {isFiltered && (
        <span className="ml-auto text-xs text-gray-400">
          {visible} of {total} rows
        </span>
      )}
    </div>
  );
}


// ── Date range filter ──────────────────────────────────────────────────────────

function DateRangeFilter({
  filters,
  set,
  minDate,
  maxDate,
}: {
  filters: Filters;
  set: (patch: Partial<Filters>) => void;
  minDate: string; // YYYY-MM-DD — earliest transaction date
  maxDate: string; // YYYY-MM-DD — latest transaction date
}) {
  // On first pick (prev value was empty) force time to 00:00 IST.
  // On subsequent changes keep whatever time the user chose.
  const handleFrom = (raw: string) => {
    if (!raw) { set({ dateFrom: "" }); return; }
    const time = filters.dateFrom ? raw.slice(11, 16) : "00:00";
    set({ dateFrom: `${raw.slice(0, 10)}T${time}` });
  };

  const handleTo = (raw: string) => {
    if (!raw) { set({ dateTo: "" }); return; }
    const time = filters.dateTo ? raw.slice(11, 16) : "00:00";
    set({ dateTo: `${raw.slice(0, 10)}T${time}` });
  };

  return (
    <div className="flex items-center gap-1.5">
      <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>

      {/* From */}
      <div className={cn(
        "flex items-center gap-1 border rounded-lg px-2 py-1 transition-colors",
        filters.dateFrom ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
      )}>
        <span className="text-xs text-gray-400 shrink-0">From</span>
        <input
          type="datetime-local"
          value={filters.dateFrom}
          min={minDate ? `${minDate}T00:00` : undefined}
          max={filters.dateTo || (maxDate ? `${maxDate}T23:59` : undefined)}
          step="60"
          onChange={(e) => handleFrom(e.target.value)}
          className="bg-transparent text-xs text-gray-700 outline-none w-[152px] cursor-pointer"
        />
        {filters.dateFrom && (
          <button onClick={() => set({ dateFrom: "" })} className="text-gray-300 hover:text-gray-500 transition-colors shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <span className="text-gray-300 text-xs">→</span>

      {/* To */}
      <div className={cn(
        "flex items-center gap-1 border rounded-lg px-2 py-1 transition-colors",
        filters.dateTo ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"
      )}>
        <span className="text-xs text-gray-400 shrink-0">To</span>
        <input
          type="datetime-local"
          value={filters.dateTo}
          min={filters.dateFrom || (minDate ? `${minDate}T00:00` : undefined)}
          max={maxDate ? `${maxDate}T23:59` : undefined}
          step="60"
          onChange={(e) => handleTo(e.target.value)}
          className="bg-transparent text-xs text-gray-700 outline-none w-[152px] cursor-pointer"
        />
        {filters.dateTo && (
          <button onClick={() => set({ dateTo: "" })} className="text-gray-300 hover:text-gray-500 transition-colors shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <span className="text-xs text-gray-300 italic">IST</span>
    </div>
  );
}

// ── Filter input ───────────────────────────────────────────────────────────────

export function FilterInput({
  icon, placeholder, value, onChange, width, inputMode, active,
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  width: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 transition-colors",
        width,
        active
          ? "border-amber-400 bg-amber-50"
          : value
          ? "border-gray-300 bg-white"
          : "border-gray-200 bg-gray-50 hover:border-gray-300"
      )}
    >
      {icon}
      <input
        type="text"
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-400 outline-none min-w-0"
      />
      {value && (
        <button onClick={() => onChange("")} className="text-gray-300 hover:text-gray-500 transition-colors shrink-0">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Summary badge ──────────────────────────────────────────────────────────────

function SummaryBadge({ label, value, color }: { label: string; value: string; color: "green" | "red" }) {
  return (
    <div className="text-xs">
      <span className="text-gray-400">{label}: </span>
      <span className={color === "green" ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
        {value}
      </span>
    </div>
  );
}

// ── Add files modal ────────────────────────────────────────────────────────────

function AddFilesModal({ onClose }: { onClose: () => void }) {
  const { appendTransactions, uploadedFileNames: alreadyUploaded } = useTransactionStore();
  const [files, setFiles] = useState<File[]>([]);
  const [addedCount, setAddedCount] = useState<number | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string[]>([]);

  const uploadMutation = useMutation({
    mutationFn: uploadFiles,
    onSuccess: (txns) => {
      appendTransactions(txns, files.map((f) => f.name));
      setAddedCount(txns.length);
      setTimeout(onClose, 1400);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not process your file. Please try again."
      );
    },
  });

  const onDrop = useCallback((accepted: File[]) => {
    const alreadySet = new Set(alreadyUploaded);
    const dupes = accepted.filter((f) => alreadySet.has(f.name));
    const fresh = accepted.filter((f) => !alreadySet.has(f.name));
    if (dupes.length) setDuplicateWarning(dupes.map((f) => f.name));
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...fresh.filter((f) => !existing.has(f.name))];
    });
  }, [alreadyUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: ACCEPTED, multiple: true,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Add more files</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {addedCount !== null ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-gray-800">{addedCount} transactions added</p>
              <p className="text-sm text-gray-400">Merging into your table...</p>
            </div>
          ) : uploadMutation.isPending ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-10 h-10 relative">
                <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
                <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-gray-500">Parsing {files.length} file{files.length > 1 ? "s" : ""}...</p>
            </div>
          ) : (
            <>
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                  isDragActive ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-brand-300 hover:bg-gray-50"
                )}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", isDragActive ? "bg-brand-100" : "bg-gray-100")}>
                    <svg className={cn("w-5 h-5", isDragActive ? "text-brand-600" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700">{isDragActive ? "Drop here" : "Drop files or browse"}</p>
                  <p className="text-xs text-gray-400">.csv, .xlsx, .xls</p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((f) => (
                    <div key={f.name} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-4 h-4 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="truncate text-gray-700">{f.name}</span>
                      </div>
                      <span className="text-gray-400 text-xs ml-2 shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                </div>
              )}

              {duplicateWarning.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-medium text-amber-700 mb-1">Already uploaded — skipped:</p>
                  {duplicateWarning.map((name) => (
                    <p key={name} className="text-xs text-amber-600 truncate">{name}</p>
                  ))}
                </div>
              )}

            </>
          )}
        </div>

        {!uploadMutation.isPending && addedCount === null && (
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => uploadMutation.mutate(files)}
              disabled={files.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-brand-200 text-white text-sm font-semibold transition-colors"
            >
              Add {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : "files"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
