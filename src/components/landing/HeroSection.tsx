import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Search, FlaskConical, FileBarChart } from 'lucide-react';

const features = [
  {
    icon: ShieldCheck,
    title: 'Reduce Attack Surface',
    desc: 'Continuously monitor and minimize your exposure to cyber threats across all digital assets.',
  },
  {
    icon: Search,
    title: 'Uncover Security Gaps',
    desc: 'Identify vulnerabilities before attackers do with deep scanning and analysis.',
  },
  {
    icon: FlaskConical,
    title: 'Test Security Controls',
    desc: 'Validate your defenses with simulated attacks and compliance-driven assessments.',
  },
  {
    icon: FileBarChart,
    title: 'Clear Reporting Insights',
    desc: 'Get actionable intelligence with executive-ready reports and real-time dashboards.',
  },
];

const HeroSection: React.FC = () => (
  <section
    id="hero"
    className="relative pt-28 pb-20 px-6 overflow-hidden"
    style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #111118 50%, #0d0d14 100%)' }}
  >
    {/* Decorative radial glows */}
    <div
      className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.07] pointer-events-none"
      style={{ background: 'radial-gradient(circle, hsl(0 100% 55%), transparent 70%)' }}
    />
    <div
      className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.05] pointer-events-none"
      style={{ background: 'radial-gradient(circle, hsl(186 100% 50%), transparent 70%)' }}
    />

    <div className="relative z-10 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
      {/* Left — Copy */}
      <div className="max-w-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-8 rounded-full bg-[#FF4D2E]" />
          <span className="text-sm font-semibold tracking-widest uppercase text-gray-300">
            Cyber Defense Solutions
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.1] text-[#FF4D2E] tracking-tight">
          Secure Your Business with Advanced Cyber Defense
        </h1>

        <p className="mt-6 text-gray-300 text-base sm:text-lg leading-relaxed max-w-md">
          Real-time monitoring, AI-driven threat detection, and enterprise-grade infrastructure protection — tailored for organizations that can't afford downtime.
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            to="/contact"
            className="inline-flex items-center px-8 py-3.5 rounded-full text-sm font-bold text-white bg-[#FF4D2E] hover:bg-[#e6432a] transition-colors shadow-lg shadow-[#FF4D2E]/20"
          >
            Secure Your Business
          </Link>
          <Link
            to="/cyber-map"
            className="inline-flex items-center px-8 py-3.5 rounded-full text-sm font-bold text-gray-300 border border-gray-700 hover:border-gray-500 hover:text-white transition-colors"
          >
            View Live Threats
          </Link>
        </div>
      </div>

      {/* Right — Feature cards grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {features.map(({ icon: Icon, title, desc }, i) => (
          <div
            key={title}
            className="group relative rounded-2xl border border-gray-800/60 bg-white/[0.03] backdrop-blur-sm p-6 hover:border-[#FF4D2E]/30 hover:bg-white/[0.06] transition-all duration-300"
          >
            <div className="w-11 h-11 rounded-xl bg-[#FF4D2E]/10 flex items-center justify-center mb-4 group-hover:bg-[#FF4D2E]/20 transition-colors">
              <Icon className="w-5 h-5 text-[#FF4D2E]" strokeWidth={1.8} />
            </div>
            <h3 className="font-bold text-white text-[15px] mb-2">{title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Bottom decorative line */}
    <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent" />
  </section>
);

export default HeroSection;
