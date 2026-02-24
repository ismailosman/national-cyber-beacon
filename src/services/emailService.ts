import { supabase } from "@/integrations/supabase/client";
import { ScanResult } from "@/types/security";

export async function sendScanCompletedEmail(
  scanData: ScanResult,
  clientEmail?: string,
  clientName?: string
) {
  const { data, error } = await supabase.functions.invoke("send-pentest-email", {
    body: { type: "scan_completed", scanData, clientEmail, clientName },
  });
  if (error) throw error;
  return data;
}

export async function sendCriticalAlertEmail(
  scanData: ScanResult,
  clientEmail?: string,
  clientName?: string
) {
  const { data, error } = await supabase.functions.invoke("send-pentest-email", {
    body: { type: "critical_alert", scanData, clientEmail, clientName },
  });
  if (error) throw error;
  return data;
}

export async function sendReportDeliveryEmail(
  scanData: ScanResult,
  reportUrl: string,
  clientEmail?: string,
  clientName?: string
) {
  const { data, error } = await supabase.functions.invoke("send-pentest-email", {
    body: { type: "report_delivery", scanData, reportUrl, clientEmail, clientName },
  });
  if (error) throw error;
  return data;
}

export function hasCriticalFindings(scanData: ScanResult): boolean {
  const findings = scanData.dast_results?.nuclei?.findings ?? [];
  return findings.some((f) =>
    ["critical", "high"].includes(f.info?.severity?.toLowerCase())
  );
}
