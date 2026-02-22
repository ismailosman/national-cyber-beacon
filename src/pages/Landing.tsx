import React from 'react';
import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import AboutSection from '@/components/landing/AboutSection';
import Footer from '@/components/landing/Footer';
import CookieConsent from '@/components/landing/CookieConsent';
import { Shield, Clock, Building2, Zap } from 'lucide-react';

const stats = [
  { icon: Clock, label: '24/7', sub: 'Real-Time Monitoring' },
  { icon: Shield, label: '99.9%', sub: 'Uptime SLA' },
  { icon: Building2, label: '50+', sub: 'Organizations Protected' },
  { icon: Zap, label: '500+', sub: 'Threats Blocked Daily' },
];

const Landing: React.FC = () => (
  <div className="min-h-screen bg-[#0a0a0f] text-white">
    <Navbar />
    <main>
      <HeroSection />

      {/* Stats Trust Bar */}
      <section className="relative border-y border-gray-800/50 bg-[#0c0c13]">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map(({ icon: Icon, label, sub }) => (
            <div key={sub} className="text-center">
              <Icon className="w-5 h-5 text-[#FF4D2E] mx-auto mb-2" strokeWidth={1.8} />
              <div className="text-2xl sm:text-3xl font-extrabold text-white">{label}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      <AboutSection />
    </main>
    <Footer />
    <CookieConsent />
  </div>
);

export default Landing;
