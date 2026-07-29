import type { CompareResponse } from "../types";

const API_BASE = "http://127.0.0.1:8000";

export async function fetchConditions(): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/api/conditions`);
  if (!res.ok) throw new Error("failed to fetch conditions");
  return res.json();
}

export async function fetchCompare(a: string, b: string): Promise<CompareResponse> {
  const res = await fetch(`${API_BASE}/api/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
  if (!res.ok) throw new Error("failed to fetch compare data -- run both conditions via run_cli.py first");
  return res.json();
}
