import React from 'react';
import { Link } from 'react-router-dom';

const HeroSection: React.FC = () => (
  <section id="hero" className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
    {/* Video background */}
    <video
      autoPlay
      muted
      loop
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
    >
      <source src="https://www.shutterstock.com/shutterstock/videos/3980532735/preview/stock-footage-futuristic-digital-earth-globe-with-glowing-global-network-connection-lines-big-data-transfer-and.webm" type="video/webm" />
      <source src="/herosection.mp4" type="video/mp4" />
    </video>

    {/* Overlay */}
    <div className="absolute inset-0 bg-black/50 dark:bg-black/50" />

    {/* Content */}
    <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
      <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm">
        <div className="w-2 h-2 rounded-full bg-[#FF4D2E] animate-pulse" />
        <span className="text-xs font-semibold tracking-widest uppercase text-white/90">
          Cyber Defense Solutions
        </span>
      </div>

      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] text-white tracking-tight">
        Precision Cyber Defense for High-Risk Environments
      </h1>

      <p className="mt-6 text-white/80 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
        Real-time monitoring, AI-driven threat detection, and enterprise-grade infrastructure
        protection — tailored for organizations that can't afford downtime.
      </p>

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          to="/contact"
          className="inline-flex items-center px-8 py-3.5 rounded-full text-sm font-bold text-white bg-[#FF4D2E] hover:bg-[#e6432a] transition-colors shadow-lg shadow-[#FF4D2E]/25"
        >
          Secure Your Business
        </Link>
        <Link
          to="/cyber-map"
          className="inline-flex items-center px-8 py-3.5 rounded-full text-sm font-bold text-white border border-white/30 hover:border-white/60 hover:bg-white/10 transition-all backdrop-blur-sm"
        >
          View Live Threats
        </Link>
      </div>
    </div>

    {/* Bottom gradient fade */}
    <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[hsl(var(--landing-bg))] to-transparent" />
  </section>
);

export default HeroSection;
