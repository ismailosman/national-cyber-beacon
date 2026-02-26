import React from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import CookieConsent from '@/components/landing/CookieConsent';

const Privacy: React.FC = () => (
  <div className="min-h-screen bg-[hsl(var(--landing-bg))] text-[hsl(var(--landing-fg))]">
    <Navbar />
    <main className="pt-28 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#FF4D2E] mb-2">Privacy Policy</h1>
        <p className="text-sm text-[hsl(var(--landing-muted))] mb-10">Last updated: February 2026</p>

        <div className="space-y-8 text-[hsl(var(--landing-muted))] leading-relaxed text-[15px]">
          <section>
            <h2 className="text-xl font-bold text-[hsl(var(--landing-fg))] mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly, such as your name, email address, and organization details when you contact us or use our services. We also automatically collect technical data including IP addresses, browser type, and usage patterns to improve our platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[hsl(var(--landing-fg))] mb-3">2. How We Use Your Information</h2>
            <p>Your information is used to provide and improve our cybersecurity monitoring services, respond to inquiries, send security alerts, generate threat reports, and comply with legal obligations. We never sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[hsl(var(--landing-fg))] mb-3">3. Cookies &amp; Tracking</h2>
            <p>We use essential cookies to ensure the proper functioning of our platform, and analytics cookies to understand how our services are used. You can manage your cookie preferences through your browser settings or our cookie consent banner.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[hsl(var(--landing-fg))] mb-3">4. Third-Party Services</h2>
            <p>We may share data with trusted partners who assist in delivering our services, such as cloud infrastructure providers and threat intelligence feeds. All partners are bound by strict data protection agreements.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[hsl(var(--landing-fg))] mb-3">5. Data Security</h2>
            <p>We employ industry-standard encryption, access controls, and security monitoring to protect your data. Our infrastructure is continuously audited for vulnerabilities, and we follow best practices for data protection.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[hsl(var(--landing-fg))] mb-3">6. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data at any time. You may also request a copy of the data we hold about you or withdraw consent for data processing. Contact us at <span className="text-[#FF4D2E]">info@cyberdefense.so</span> to exercise these rights.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[hsl(var(--landing-fg))] mb-3">7. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, please contact us at <span className="text-[#FF4D2E]">info@cyberdefense.so</span>.</p>
          </section>
        </div>
      </div>
    </main>
    <Footer />
    <CookieConsent />
  </div>
);

export default Privacy;
