export type CategoryKey =
  | "konsumsi"
  | "transportasi"
  | "gaji"
  | "kesehatan"
  | "hiburan"
  | "cicilan"
  | "keluarga"
  | "operasional"
  | "lainnya"
  | "pendapatan"
  | "penjualan"
  | "investasi";

export const EXPENSE_CATEGORIES: {
  key: CategoryKey;
  label: string;
  icon: string;
  color: string;
}[] = [
  { key: "konsumsi", label: "Konsumsi", icon: "shopping-bag", color: "#f59e0b" },
  { key: "transportasi", label: "Transportasi", icon: "truck", color: "#3b82f6" },
  { key: "gaji", label: "Gaji Karyawan", icon: "users", color: "#8b5cf6" },
  { key: "kesehatan", label: "Kesehatan", icon: "heart", color: "#ef4444" },
  { key: "hiburan", label: "Hiburan", icon: "music", color: "#ec4899" },
  { key: "cicilan", label: "Cicilan", icon: "credit-card", color: "#0ea5e9" },
  { key: "keluarga", label: "Transfer Keluarga", icon: "gift", color: "#f97316" },
  { key: "operasional", label: "Operasional", icon: "briefcase", color: "#14b8a6" },
  { key: "lainnya", label: "Lainnya", icon: "more-horizontal", color: "#64748b" },
];

export const INCOME_CATEGORIES: {
  key: CategoryKey;
  label: string;
  icon: string;
  color: string;
}[] = [
  { key: "pendapatan", label: "Pendapatan", icon: "trending-up", color: "#10b981" },
  { key: "penjualan", label: "Penjualan", icon: "shopping-cart", color: "#059669" },
  { key: "investasi", label: "Investasi", icon: "bar-chart-2", color: "#0891b2" },
  { key: "lainnya", label: "Lainnya", icon: "plus-circle", color: "#64748b" },
];

export function categoryMeta(key: string) {
  const all = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  return (
    all.find((c) => c.key === key) || {
      key: "lainnya",
      label: "Lainnya",
      icon: "more-horizontal",
      color: "#64748b",
    }
  );
}

export const ASSET_KINDS: { key: string; label: string; icon: string }[] = [
  { key: "bank", label: "Rekening Bank", icon: "credit-card" },
  { key: "company", label: "Rekening Perusahaan", icon: "briefcase" },
  { key: "ewallet", label: "E-Wallet", icon: "smartphone" },
  { key: "receivable", label: "Piutang", icon: "user-check" },
  { key: "cash", label: "Uang Tunai", icon: "dollar-sign" },
  { key: "other", label: "Lainnya", icon: "box" },
];
