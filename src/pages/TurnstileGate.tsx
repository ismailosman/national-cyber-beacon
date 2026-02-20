import { useState, useEffect, useRef, useCallback } from "react";
import CyberMap from "./CyberMap";
import logoEmblem from "@/assets/logo-emblem.png";

const TURNSTILE_SITE_KEY = "0x4AAAAAACfqOh5kqOZCLMB6";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const TurnstileGate = () => {
  const [verified, setVerified] = useState(() => sessionStorage.getItem("turnstile_verified") === "true");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const handleToken = useCallback(async (token: string) => {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-turnstile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem("turnstile_verified", "true");
        setVerified(true);
      } else {
        setError("Verification failed. Please try again.");
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      }
    } catch {
      setError("Network error. Please try again.");
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    } finally {
      setVerifying(false);
    }
  }, []);

  useEffect(() => {
    if (verified) return;

    const renderWidget = () => {
      if (!widgetRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;

      widgetIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        callback: handleToken,
        "error-callback": () => setError("Challenge failed. Please try again."),
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [verified, handleToken]);

  if (verified) return <CyberMap />;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md w-full px-6">
        {/* Logo */}
        <img src={logoEmblem} alt="Somalia Cyber Defence" className="w-16 h-16 mb-2" />

        {/* Heading */}
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Verifying you are human
          </h1>
          <p className="text-sm text-muted-foreground">
            This process is automatic. Your browser will redirect shortly.
          </p>
        </div>

        {/* Turnstile widget */}
        <div className="glass-card rounded-lg p-6 flex flex-col items-center gap-4 w-full">
          <div ref={widgetRef} className="min-h-[65px] flex items-center justify-center" />
          
          {verifying && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Verifying...
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          cyberdefense.so needs to review the security of your connection before proceeding.
        </p>
      </div>
    </div>
  );
};

export default TurnstileGate;
