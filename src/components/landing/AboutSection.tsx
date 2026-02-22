import React from 'react';
import { ShieldCheck, Target, BarChart3, Users } from 'lucide-react';

const highlights = [
  { icon: ShieldCheck, title: 'Proactive Defense', desc: 'We identify and neutralize threats before they impact your operations.', gradient: 'from-orange-500 to-red-500', bgLight: 'bg-orange-50' },
  { icon: Target, title: 'Precision Monitoring', desc: 'Continuous surveillance of your digital assets with zero blind spots.', gradient: 'from-blue-500 to-indigo-600', bgLight: 'bg-blue-50' },
  { icon: BarChart3, title: 'Actionable Intelligence', desc: 'Data-driven insights that turn raw threat data into strategic decisions.', gradient: 'from-emerald-500 to-teal-600', bgLight: 'bg-emerald-50' },
  { icon: Users, title: 'Expert Team', desc: 'Seasoned cybersecurity analysts and engineers working around the clock.', gradient: 'from-purple-500 to-pink-500', bgLight: 'bg-purple-50' },
];

const AboutSection: React.FC = () => (
  <section id="about" className="py-20 px-6 bg-gradient-to-br from-gray-50 via-white to-orange-50/40">
    <div className="max-w-7xl mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <span className="inline-block px-4 py-1.5 rounded-full bg-[#FF4D2E]/10 text-[#FF4D2E] text-xs font-bold uppercase tracking-wider mb-4">
          Who We Are
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">About Us</h2>
        <p className="mt-4 text-gray-500 leading-relaxed">
          CyberDefense is a cybersecurity company dedicated to protecting businesses and critical infrastructure from evolving digital threats. Our mission is to make enterprise-grade security accessible, intelligent, and relentless.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {highlights.map(({ icon: Icon, title, desc, gradient, bgLight }) => (
          <div
            key={title}
            className={`${bgLight} rounded-xl border border-gray-100 p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300`}
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-lg`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default AboutSection;
