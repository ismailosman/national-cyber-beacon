import React from 'react';
import { ShieldCheck, Target, BarChart3, Users } from 'lucide-react';

const highlights = [
  { icon: ShieldCheck, title: 'Proactive Defense', desc: 'We identify and neutralize threats before they impact your operations.' },
  { icon: Target, title: 'Precision Monitoring', desc: 'Continuous surveillance of your digital assets with zero blind spots.' },
  { icon: BarChart3, title: 'Actionable Intelligence', desc: 'Data-driven insights that turn raw threat data into strategic decisions.' },
  { icon: Users, title: 'Expert Team', desc: 'Seasoned cybersecurity analysts and engineers working around the clock.' },
];

const AboutSection: React.FC = () => (
  <section id="about" className="py-20 px-6 bg-gray-50">
    <div className="max-w-7xl mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">About Us</h2>
        <p className="mt-4 text-gray-500 leading-relaxed">
          CyberDefense is a cybersecurity company dedicated to protecting businesses and critical infrastructure from evolving digital threats. Our mission is to make enterprise-grade security accessible, intelligent, and relentless.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {highlights.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="w-11 h-11 rounded-lg bg-[#FF4D2E]/10 flex items-center justify-center mb-4">
              <Icon className="w-5 h-5 text-[#FF4D2E]" />
            </div>
            <h3 className="font-bold text-gray-900">{title}</h3>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default AboutSection;
