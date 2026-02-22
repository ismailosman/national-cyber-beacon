import React from 'react';
import Navbar from '@/components/landing/Navbar';
import PortfolioSection from '@/components/landing/PortfolioSection';
import Footer from '@/components/landing/Footer';
import CookieConsent from '@/components/landing/CookieConsent';

const Portfolio: React.FC = () => (
  <div className="min-h-screen bg-white text-gray-900" style={{ colorScheme: 'light' }}>
    <Navbar />
    <main className="pt-20">
      <PortfolioSection />
    </main>
    <Footer />
    <CookieConsent />
  </div>
);

export default Portfolio;
