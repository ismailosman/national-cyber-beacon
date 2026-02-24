import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import logo from "@/assets/logo.png";

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

interface TurnstileGateProps {
  children: ReactNode;
  sessionKey?: string;
  domain?: string;
}

const TurnstileGate = ({ children, sessionKey = "turnstile_verified", domain = "cyberdefense.so" }: TurnstileGateProps) => {
  const [verified, setVerified] = useState(() => sessionStorage.getItem(sessionKey) === "true");
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
        sessionStorage.setItem(sessionKey, "true");
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
  }, [sessionKey]);

  useEffect(() => {
    if (verified) return;

    const renderWidget = () => {
      if (!widgetRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return;

      widgetIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light",
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

  // Bypass on dev/preview domains
  const hostname = window.location.hostname;
  const bypassed = hostname === "localhost" || hostname.includes("lovable.app");

  if (bypassed || verified) return <>{children}</>;

  return (
    <div className="min-h-screen bg-white flex flex-col items-start justify-start pt-[15vh] px-8 md:px-16">
      <div className="max-w-2xl w-full">
        {/* Domain header */}
        <div className="flex items-center gap-3 mb-4">
          <img
            src={logo}
            alt="Somalia Cyber Defence"
            className="w-10 h-10"
          />
          <span className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
            {domain}
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-xl md:text-2xl font-semibold text-gray-800 mb-2">
          Performing security verification
        </h1>

        {/* Description */}
        <p className="text-sm text-gray-500 mb-8 leading-relaxed max-w-xl">
          This website uses a security service to protect against malicious bots.
          This page is displayed while the website verifies you are not a bot.
        </p>

        {/* Turnstile widget */}
        <div className="border border-gray-200 rounded-lg p-4 inline-block">
          <div ref={widgetRef} className="min-h-[65px] flex items-center justify-center" />
        </div>

        {verifying && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            Verifying...
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 mt-4">{error}</p>
        )}
      </div>
    </div>
  );
};

export default TurnstileGate;
