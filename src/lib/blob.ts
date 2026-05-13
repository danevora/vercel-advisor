import { put, list } from '@vercel/blob';
import type { Report } from './schemas';
import { ReportSchema } from './schemas';

const PREFIX = 'reports/';

export async function saveReport(report: Report): Promise<{ url: string }> {
  const blob = await put(`${PREFIX}${report.id}.json`, JSON.stringify(report), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { url: blob.url };
}

export async function loadReport(id: string): Promise<Report | null> {
  // We use list+fetch instead of a direct content addressed URL so the route
  // works whether or not BLOB_READ_WRITE_TOKEN is set (e.g. local dev fallback).
  const { blobs } = await list({ prefix: `${PREFIX}${id}` });
  const found = blobs.find((b) => b.pathname === `${PREFIX}${id}.json`);
  if (!found) return null;
  const res = await fetch(found.url, { cache: 'no-store' });
  if (!res.ok) return null;
  const parsed = ReportSchema.safeParse(await res.json());
  return parsed.success ? parsed.data : null;
}
