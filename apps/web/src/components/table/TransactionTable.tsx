"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Transaction, CATEGORIES } from "@/types/transaction";
import { useTransactionStore } from "@/store/transactionStore";
import { cn, formatCurrency } from "@/lib/utils";

const col = createColumnHelper<Transaction>();

interface Props {
  /** Pre-filtered list from TableScreen. Sorting still handled here via TanStack. */
  data: Transaction[];
  allCount: number;
}

export function TransactionTable({ data, allCount }: Props) {
  const { editedIds, updateTransaction } = useTransactionStore();
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: false }]);

  const columns = useMemo(
    () => [
      col.accessor("date", {
        header: "Date",
        size: 120,
        cell: ({ row, getValue }) => (
          <EditableCell
            value={getValue()}
            type="date"
            isEdited={editedIds.has(row.original.id)}
            onChange={(v) => updateTransaction(row.original.id, { date: v })}
          />
        ),
      }),
      col.accessor("description", {
        header: "Description",
        size: 280,
        cell: ({ row, getValue }) => (
          <EditableCell
            value={getValue()}
            type="text"
            isEdited={editedIds.has(row.original.id)}
            onChange={(v) => updateTransaction(row.original.id, { description: v })}
          />
        ),
      }),
      col.accessor("amount", {
        header: "Amount",
        size: 130,
        cell: ({ row, getValue }) => (
          <EditableCell
            value={String(getValue())}
            type="number"
            displayValue={formatCurrency(getValue())}
            isEdited={editedIds.has(row.original.id)}
            onChange={(v) =>
              updateTransaction(row.original.id, { amount: parseFloat(v) || 0 })
            }
          />
        ),
      }),
      col.accessor("type", {
        header: "Type",
        size: 100,
        cell: ({ row, getValue }) => (
          <SelectCell
            value={getValue()}
            isEdited={editedIds.has(row.original.id)}
            options={[
              { value: "credit", label: "Credit" },
              { value: "debit", label: "Debit" },
            ]}
            onChange={(v) =>
              updateTransaction(row.original.id, { type: v as Transaction["type"] })
            }
          />
        ),
      }),
      col.accessor("category", {
        header: "Category",
        size: 160,
        cell: ({ row, getValue }) => (
          <SelectCell
            value={getValue()}
            isEdited={editedIds.has(row.original.id)}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            onChange={(v) => updateTransaction(row.original.id, { category: v })}
            allowCustom
          />
        ),
      }),
      col.accessor("reference", {
        header: "Reference",
        size: 150,
        cell: ({ row, getValue }) => (
          <EditableCell
            value={getValue()}
            type="text"
            isEdited={editedIds.has(row.original.id)}
            onChange={(v) => updateTransaction(row.original.id, { reference: v })}
          />
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editedIds]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const dateSort = sorting.find((s) => s.id === "date");
  const setDateSort = (desc: boolean) =>
    setSorting((prev) => [
      { id: "date", desc },
      ...prev.filter((s) => s.id !== "date"),
    ]);

  const isFiltered = data.length < allCount;

  if (allCount === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No transactions found.
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Date sort + filter status strip */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-gray-400">Date</span>
        <button
          title="Oldest first"
          onClick={() => setDateSort(false)}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
            dateSort && !dateSort.desc
              ? "bg-brand-100 text-brand-700"
              : "text-gray-500 hover:bg-gray-100"
          )}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          Asc
        </button>
        <button
          title="Newest first"
          onClick={() => setDateSort(true)}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
            dateSort?.desc
              ? "bg-brand-100 text-brand-700"
              : "text-gray-500 hover:bg-gray-100"
          )}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Desc
        </button>

        {isFiltered && (
          <span className="ml-auto text-xs text-amber-600 font-medium flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Showing {data.length} of {allCount} — edits on filtered rows are saved
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">No transactions match your filters.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  <th className="w-10 px-4 py-3 text-left text-xs font-semibold text-gray-400">#</th>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide select-none"
                    >
                      <button
                        className="flex items-center gap-1 hover:text-gray-800 transition-colors"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon state={header.column.getIsSorted()} />
                      </button>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-gray-100 transition-colors",
                    editedIds.has(row.original.id)
                      ? "bg-amber-50/60"
                      : idx % 2 === 0
                      ? "bg-white"
                      : "bg-gray-50/50",
                    "hover:bg-blue-50/30"
                  )}
                >
                  <td className="px-4 py-2 text-xs text-gray-300 tabular-nums">{idx + 1}</td>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-2 py-1.5 editable-cell",
                        editedIds.has(row.original.id) && "cell-edited"
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Cell components ────────────────────────────────────────────────────────────

interface EditableCellProps {
  value: string;
  isEdited: boolean;
  type: "text" | "number" | "date";
  displayValue?: string;
  onChange: (v: string) => void;
}

function EditableCell({ value, type, displayValue, onChange }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className="w-full bg-white border border-brand-400 rounded px-2 py-0.5 outline-none ring-2 ring-brand-200 text-sm"
      />
    );
  }

  return (
    <div
      onClick={() => { setDraft(value); setEditing(true); }}
      className="min-h-[24px] px-2 py-0.5 cursor-text rounded hover:bg-blue-50 transition-colors truncate"
      title={value}
    >
      {displayValue ?? value || <span className="text-gray-300 italic text-xs">—</span>}
    </div>
  );
}

interface SelectCellProps {
  value: string;
  isEdited: boolean;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  allowCustom?: boolean;
}

function SelectCell({ value, options, onChange, allowCustom }: SelectCellProps) {
  const isKnown = options.some((o) => o.value === value);
  return (
    <select
      value={isKnown ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent border-0 text-sm rounded px-2 py-0.5 cursor-pointer hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:bg-white transition-colors"
    >
      {!isKnown && <option value="" disabled>{value || "Select..."}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      {allowCustom && !isKnown && value && <option value={value}>{value}</option>}
    </select>
  );
}

function SortIcon({ state }: { state: false | "asc" | "desc" }) {
  if (!state)
    return (
      <svg className="w-3 h-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    );
  return (
    <svg className="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={state === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
    </svg>
  );
}
