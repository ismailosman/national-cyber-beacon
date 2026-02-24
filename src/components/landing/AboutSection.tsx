import React from 'react';
import { ShieldCheck, Target, BarChart3, Users } from 'lucide-react';

const highlights = [
  { icon: ShieldCheck, title: 'Proactive Defense', desc: 'We identify and neutralize threats before they impact your operations.', accent: '#FF4D2E' },
  { icon: Target, title: 'Precision Monitoring', desc: 'Continuous surveillance of your digital assets with zero blind spots.', accent: '#3b82f6' },
  { icon: BarChart3, title: 'Actionable Intelligence', desc: 'Data-driven insights that turn raw threat data into strategic decisions.', accent: '#10b981' },
  { icon: Users, title: 'Expert Team', desc: 'Seasoned cybersecurity analysts and engineers working around the clock.', accent: '#a855f7' },
];

const AboutSection: React.FC = () => (
  <section id="about" className="py-24 px-6 bg-[hsl(var(--landing-bg))]">
    <div className="max-w-7xl mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <span className="inline-block px-4 py-1.5 rounded-full bg-[#FF4D2E]/10 text-[#FF4D2E] text-xs font-bold uppercase tracking-wider mb-4">
          Who We Are
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-[hsl(var(--landing-fg))]">About Us</h2>
        <p className="mt-4 text-[hsl(var(--landing-muted))] leading-relaxed">
          CyberDefense is a cybersecurity company dedicated to protecting businesses and critical infrastructure from evolving digital threats. Our mission is to make enterprise-grade security accessible, intelligent, and relentless.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {highlights.map(({ icon: Icon, title, desc, accent }) => (
          <div
            key={title}
            className="animated-border-wrapper group hover:-translate-y-1 transition-all duration-300"
          >
            <div className="animated-border-inner p-6 h-full">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${accent}15` }}
              >
                <Icon className="w-6 h-6" style={{ color: accent }} />
              </div>
              <h3 className="font-bold text-[hsl(var(--landing-fg))] text-lg">{title}</h3>
              <p className="mt-2 text-sm text-[hsl(var(--landing-muted))] leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default AboutSection;
