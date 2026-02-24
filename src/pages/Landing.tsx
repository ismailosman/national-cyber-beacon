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
  <div className="min-h-screen bg-[hsl(var(--landing-bg))] text-[hsl(var(--landing-fg))]">
    <Navbar />
    <main>
      <HeroSection />

      {/* Stats Trust Bar */}
      <section className="relative">
        <div className="animated-border-line" />
        <div className="bg-[hsl(var(--landing-card))]">
          <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map(({ icon: Icon, label, sub }) => (
              <div key={sub} className="text-center">
                <Icon className="w-5 h-5 text-[#FF4D2E] mx-auto mb-2" strokeWidth={1.8} />
                <div className="text-2xl sm:text-3xl font-extrabold text-[hsl(var(--landing-fg))]">{label}</div>
                <div className="text-xs sm:text-sm text-[hsl(var(--landing-muted))] mt-1">{sub}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="animated-border-line" />
      </section>

      <AboutSection />
    </main>
    <Footer />
    <CookieConsent />
  </div>
);

export default Landing;
