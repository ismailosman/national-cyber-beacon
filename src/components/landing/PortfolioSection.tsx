import React from 'react';
import { Radar, Monitor, Server, ShieldAlert } from 'lucide-react';

const services = [
  {
    icon: Radar,
    title: 'Threat Detection',
    desc: 'AI-powered threat detection that identifies malware, phishing, and zero-day exploits in real time.',
  },
  {
    icon: Monitor,
    title: 'Real-Time Monitoring',
    desc: 'Continuous 24/7 monitoring of networks, endpoints, and cloud environments with instant alerting.',
  },
  {
    icon: Server,
    title: 'Infrastructure Protection',
    desc: 'Harden your servers, databases, and cloud assets against DDoS, intrusion, and data exfiltration.',
  },
  {
    icon: ShieldAlert,
    title: 'Incident Response',
    desc: 'Rapid containment and forensic analysis when breaches occur, minimizing damage and downtime.',
  },
];

const PortfolioSection: React.FC = () => (
  <section id="portfolio" className="py-20 px-6 bg-white">
    <div className="max-w-7xl mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Our Services</h2>
        <p className="mt-4 text-gray-500 leading-relaxed">
          Comprehensive cybersecurity solutions tailored to protect modern enterprises from sophisticated digital threats.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        {services.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="group rounded-xl border border-gray-100 p-8 hover:border-[#FF4D2E]/30 hover:shadow-lg transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-[#FF4D2E]/10 flex items-center justify-center mb-5 group-hover:bg-[#FF4D2E] group-hover:text-white transition-colors">
              <Icon className="w-6 h-6 text-[#FF4D2E] group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default PortfolioSection;
