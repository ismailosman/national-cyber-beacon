import React from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import CookieConsent from '@/components/landing/CookieConsent';

const Terms: React.FC = () => (
  <div className="min-h-screen bg-[#0a0a0f] text-white">
    <Navbar />
    <main className="pt-28 pb-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#FF4D2E] mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: February 2026</p>

        <div className="space-y-8 text-gray-300 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using CyberDefense services, you agree to be bound by these Terms of Service. If you do not agree, you may not use our services. These terms apply to all users, including organizations, analysts, and administrators.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Description of Services</h2>
            <p>CyberDefense provides cybersecurity monitoring, threat intelligence, vulnerability assessment, and compliance auditing services. Our platform offers real-time threat detection, security scoring, and incident response capabilities for organizations and critical infrastructure.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. User Obligations</h2>
            <p>You agree to use our services only for lawful purposes, maintain the confidentiality of your account credentials, promptly report any unauthorized access, and not attempt to interfere with or disrupt our platform's operation.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Intellectual Property</h2>
            <p>All content, software, and materials provided through CyberDefense are protected by intellectual property laws. You may not copy, modify, distribute, or reverse-engineer any part of our platform without prior written consent.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Limitation of Liability</h2>
            <p>CyberDefense provides security monitoring and intelligence on a best-effort basis. We are not liable for any damages resulting from security incidents, data breaches, or service interruptions beyond our reasonable control. Our total liability shall not exceed the fees paid for the services.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Termination</h2>
            <p>Either party may terminate the service agreement with written notice. Upon termination, your access to the platform will be revoked and your data will be handled in accordance with our Privacy Policy and applicable data retention requirements.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Governing Law</h2>
            <p>These terms shall be governed by and construed in accordance with the laws of the Federal Republic of Somalia. Any disputes shall be resolved through arbitration in Mogadishu.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Contact Us</h2>
            <p>For questions about these Terms of Service, contact us at <span className="text-[#FF4D2E]">info@cyberdefense.so</span>.</p>
          </section>
        </div>
      </div>
    </main>
    <Footer />
    <CookieConsent />
  </div>
);

export default Terms;
