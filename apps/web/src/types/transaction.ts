export type TransactionType = "debit" | "credit";

export const CATEGORIES = [
  "Sales",
  "Purchase",
  "Salary",
  "Rent",
  "Utilities",
  "Travel",
  "Marketing",
  "Office Supplies",
  "Tax",
  "Bank Charges",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Transaction {
  id: string;
  date: string;          // YYYY-MM-DD
  description: string;
  amount: number;
  type: TransactionType;
  account: string;
  category: Category | string;
  reference: string;
}
