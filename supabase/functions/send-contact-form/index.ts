import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const body = await req.json();
    const { firstName, lastName, email, company, title, phone, services, country, orgSize, comments } = body;

    if (!firstName || !lastName || !email) {
      return new Response(JSON.stringify({ error: "First name, last name, and email are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const servicesList = (services || []).join(", ") || "None selected";

    const html = `
      <h2>New Consultation Request</h2>
      <table style="border-collapse:collapse;width:100%;max-width:600px;">
        <tr><td style="padding:8px;font-weight:bold;border:1px solid #ddd;">Name</td><td style="padding:8px;border:1px solid #ddd;">${firstName} ${lastName}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border:1px solid #ddd;">Email</td><td style="padding:8px;border:1px solid #ddd;">${email}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border:1px solid #ddd;">Company</td><td style="padding:8px;border:1px solid #ddd;">${company || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border:1px solid #ddd;">Title</td><td style="padding:8px;border:1px solid #ddd;">${title || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border:1px solid #ddd;">Phone</td><td style="padding:8px;border:1px solid #ddd;">${phone || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border:1px solid #ddd;">Services</td><td style="padding:8px;border:1px solid #ddd;">${servicesList}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border:1px solid #ddd;">Country</td><td style="padding:8px;border:1px solid #ddd;">${country || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border:1px solid #ddd;">Org Size</td><td style="padding:8px;border:1px solid #ddd;">${orgSize || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border:1px solid #ddd;">Comments</td><td style="padding:8px;border:1px solid #ddd;">${comments || "—"}</td></tr>
      </table>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CyberDefense <noreply@cyberdefense.so>",
        to: ["osmando@gmail.com", "info@cyberdefense.so"],
        subject: `Consultation Request from ${firstName} ${lastName}`,
        html: html + `
          <br/>
          <table style="border-top:2px solid #e2e8f0;padding-top:16px;margin-top:24px;width:100%;max-width:600px;">
            <tr><td>
              <p style="color:#0f172a;font-size:14px;font-weight:bold;margin:0;">Cyber Defense Inc</p>
              <p style="color:#64748b;font-size:12px;margin:4px 0 0;">Cyber Intelligence • Threat Monitoring • Digital Resilience</p>
              <p style="color:#64748b;font-size:12px;margin:12px 0 4px;">📧 <a href="mailto:info@cyberdefense.so" style="color:#2563eb;">info@cyberdefense.so</a></p>
              <p style="color:#64748b;font-size:12px;margin:0 0 4px;">🌐 <a href="https://www.cyberdefense.so" style="color:#2563eb;">www.cyberdefense.so</a></p>
              <p style="color:#64748b;font-size:12px;margin:0;">🛡️ Protecting Digital Infrastructure Across Nations</p>
            </td></tr>
          </table>`,
        reply_to: email,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", res.status, errText);
      throw new Error(`Email send failed: ${res.status}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-contact-form error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
