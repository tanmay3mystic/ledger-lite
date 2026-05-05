import { create } from "zustand";
import { Transaction } from "@/types/transaction";

type AppView = "upload" | "processing" | "table";

interface TransactionStore {
  transactions: Transaction[];
  view: AppView;
  uploadedFileNames: string[];
  editedIds: Set<string>;

  setView: (view: AppView) => void;
  setTransactions: (txns: Transaction[]) => void;
  setUploadedFileNames: (names: string[]) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  reset: () => void;
}

export const useTransactionStore = create<TransactionStore>((set) => ({
  transactions: [],
  view: "upload",
  uploadedFileNames: [],
  editedIds: new Set(),

  setView: (view) => set({ view }),

  setTransactions: (transactions) =>
    set({ transactions, editedIds: new Set() }),

  setUploadedFileNames: (uploadedFileNames) => set({ uploadedFileNames }),

  updateTransaction: (id, patch) =>
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, ...patch } : t
      ),
      editedIds: new Set([...state.editedIds, id]),
    })),

  reset: () =>
    set({
      transactions: [],
      view: "upload",
      uploadedFileNames: [],
      editedIds: new Set(),
    }),
}));
