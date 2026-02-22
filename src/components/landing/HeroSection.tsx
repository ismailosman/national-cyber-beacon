import React from 'react';
import { Shield, Laptop, Wifi, Lock, Eye, Server } from 'lucide-react';

const HeroSection: React.FC = () => (
  <section id="hero" className="pt-28 pb-20 px-6 bg-white">
    <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
      {/* Left — Copy */}
      <div className="max-w-lg">
        <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold leading-tight text-gray-900 tracking-tight">
          Advanced Cyber Defense for Modern Businesses
        </h1>
        <p className="mt-5 text-gray-500 text-base sm:text-lg leading-relaxed">
          Real-time monitoring, AI-driven threat detection, and enterprise-grade infrastructure protection.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href="#contact"
            className="inline-flex items-center px-7 py-3 rounded-lg text-sm font-bold text-white bg-[#FF4D2E] hover:bg-[#e6432a] transition-colors shadow-sm"
          >
            Get Started
          </a>
          <a
            href="#contact"
            className="inline-flex items-center px-7 py-3 rounded-lg text-sm font-bold text-[#FF4D2E] border-2 border-[#FF4D2E] hover:bg-[#FF4D2E]/5 transition-colors"
          >
            Request Consultation
          </a>
        </div>
      </div>

      {/* Right — Illustration */}
      <div className="relative flex items-center justify-center" aria-hidden="true">
        {/* Background circle */}
        <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-[#FF4D2E]/5" />

        {/* Central shield */}
        <div className="relative z-10 w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-gradient-to-br from-[#FF4D2E] to-[#ff7a5c] flex items-center justify-center shadow-lg animate-float">
          <Shield className="w-16 h-16 sm:w-20 sm:h-20 text-white" strokeWidth={1.5} />
        </div>

        {/* Orbiting elements */}
        <div className="absolute top-4 right-8 sm:top-6 sm:right-12 w-14 h-14 rounded-xl bg-white border border-gray-200 shadow-md flex items-center justify-center animate-float-delayed">
          <Laptop className="w-7 h-7 text-[#FF4D2E]" />
        </div>

        <div className="absolute bottom-6 left-4 sm:bottom-8 sm:left-8 w-12 h-12 rounded-xl bg-white border border-gray-200 shadow-md flex items-center justify-center animate-float-slow">
          <Lock className="w-6 h-6 text-gray-600" />
        </div>

        <div className="absolute top-8 left-4 sm:top-10 sm:left-10 w-11 h-11 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center animate-float-delayed">
          <Wifi className="w-5 h-5 text-[#FF4D2E]/80" />
        </div>

        <div className="absolute bottom-10 right-2 sm:bottom-12 sm:right-6 w-11 h-11 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center animate-float-slow">
          <Eye className="w-5 h-5 text-gray-500" />
        </div>

        <div className="absolute top-1/2 -translate-y-1/2 -left-2 sm:left-0 w-10 h-10 rounded-lg bg-white border border-gray-200 shadow flex items-center justify-center animate-float">
          <Server className="w-5 h-5 text-gray-500" />
        </div>

        {/* Dots decoration */}
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-[#FF4D2E]/20"
            style={{
              top: `${15 + Math.sin(i * 1.2) * 35}%`,
              left: `${10 + Math.cos(i * 1.5) * 40 + 40}%`,
            }}
          />
        ))}
      </div>
    </div>
  </section>
);

export default HeroSection;
