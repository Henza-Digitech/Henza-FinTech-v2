const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  // transactions
  listTransactions: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req(`/transactions${qs ? `?${qs}` : ""}`);
  },
  createTransaction: (body: any) =>
    req("/transactions", { method: "POST", body: JSON.stringify(body) }),
  updateTransaction: (id: string, body: any) =>
    req(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTransaction: (id: string) =>
    req(`/transactions/${id}`, { method: "DELETE" }),

  // export / import
  exportAll: () => req(`/export`),
  importAll: (body: any) =>
    req(`/import`, { method: "POST", body: JSON.stringify(body) }),

  // assets
  listAssets: () => req("/assets"),
  createAsset: (body: any) =>
    req("/assets", { method: "POST", body: JSON.stringify(body) }),
  updateAsset: (id: string, body: any) =>
    req(`/assets/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteAsset: (id: string) => req(`/assets/${id}`, { method: "DELETE" }),

  // bills
  listBills: () => req("/bills"),
  upcomingBills: (days = 30) => req(`/bills/upcoming?days=${days}`),
  createBill: (body: any) =>
    req("/bills", { method: "POST", body: JSON.stringify(body) }),
  updateBill: (id: string, body: any) =>
    req(`/bills/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteBill: (id: string) => req(`/bills/${id}`, { method: "DELETE" }),

  // contacts
  listContacts: (q?: string) =>
    req(`/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createContact: (body: any) =>
    req("/contacts", { method: "POST", body: JSON.stringify(body) }),
  updateContact: (id: string, body: any) =>
    req(`/contacts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteContact: (id: string) =>
    req(`/contacts/${id}`, { method: "DELETE" }),

  // transfer schedules
  listSchedules: () => req("/schedules"),
  createSchedule: (body: any) =>
    req("/schedules", { method: "POST", body: JSON.stringify(body) }),
  updateSchedule: (id: string, body: any) =>
    req(`/schedules/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteSchedule: (id: string) =>
    req(`/schedules/${id}`, { method: "DELETE" }),
  reorderSchedules: (ids: string[]) =>
    req(`/schedules/reorder`, { method: "POST", body: JSON.stringify({ ids }) }),

  // summary
  summary: (scope?: string) =>
    req(`/summary${scope ? `?scope=${scope}` : ""}`),
  analytics: (months = 6, scope: string = "all") =>
    req(`/analytics?months=${months}&scope=${scope}`),

  // ai
  aiTips: () => req("/ai/tips", { method: "POST", body: JSON.stringify({}) }),

  // folders + files
  listFolders: (q?: string) =>
    req(`/folders${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createFolder: (body: any) =>
    req("/folders", { method: "POST", body: JSON.stringify(body) }),
  updateFolder: (id: string, body: any) =>
    req(`/folders/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteFolder: (id: string) =>
    req(`/folders/${id}`, { method: "DELETE" }),
  listFiles: (folderId: string) => req(`/folders/${folderId}/files`),
  uploadFile: (folderId: string, body: any) =>
    req(`/folders/${folderId}/files`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getFile: (fileId: string) => req(`/files/${fileId}`),
  deleteFile: (fileId: string) =>
    req(`/files/${fileId}`, { method: "DELETE" }),
};

export function formatIDR(n: number): string {
  if (!isFinite(n)) return "Rp 0";
  const abs = Math.abs(n);
  const s = abs.toLocaleString("id-ID", { maximumFractionDigits: 0 });
  return `${n < 0 ? "-" : ""}Rp ${s}`;
}

export function shortIDR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `Rp ${(n / 1_000).toFixed(1)}rb`;
  return `Rp ${n.toFixed(0)}`;
}
