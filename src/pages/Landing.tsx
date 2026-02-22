import React from 'react';
import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import AboutSection from '@/components/landing/AboutSection';
import PortfolioSection from '@/components/landing/PortfolioSection';
import ContactSection from '@/components/landing/ContactSection';
import Footer from '@/components/landing/Footer';

const Landing: React.FC = () => (
  <div className="min-h-screen bg-white text-gray-900" style={{ colorScheme: 'light' }}>
    <Navbar />
    <main>
      <HeroSection />
      <AboutSection />
      <PortfolioSection />
      <ContactSection />
    </main>
    <Footer />
  </div>
);

export default Landing;
