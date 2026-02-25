import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getScan } from "@/services/securityApi";
import ScanResults from "@/components/scanner/ScanResults";
import ScanReportCharts from "@/components/scanner/ScanReportCharts";
import { ScanResult } from "@/types/security";
import { FileDown, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function ScanReport() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pdfUrl = id ? `${SUPABASE_URL}/storage/v1/object/public/scan-reports/${id}/report.pdf` : null;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getScan(id)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground">{error || "Scan not found"}</p>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <FileDown className="w-4 h-4 mr-2" /> Try PDF Download
            </Button>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground font-mono">Security Scan Report</h1>
            <p className="text-muted-foreground text-sm">{result.target} — {result.type?.toUpperCase()}</p>
          </div>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <FileDown className="w-4 h-4 mr-2" /> Download PDF
              </Button>
            </a>
          )}
        </div>
        <ScanReportCharts result={result} />
        <ScanResults result={result} />
      </div>
    </div>
  );
}
