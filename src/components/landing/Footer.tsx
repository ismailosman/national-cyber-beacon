import React from 'react';
import { Link } from 'react-router-dom';
import logoSrc from '@/assets/logo.png';

const quickLinks = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/#about' },
  { label: 'Portfolio', to: '/portfolio' },
  { label: 'Contact', to: '/contact' },
];

const serviceLinks = [
  'Threat Monitoring',
  'Vulnerability Assessment',
  'Penetration Testing',
  'Incident Response',
  'Compliance Auditing',
];

const Footer: React.FC = () => (
  <footer className="bg-[#0a0a0f] text-gray-400 border-t border-gray-800/50">
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="sm:col-span-2 lg:col-span-1">
          <img src={logoSrc} alt="CyberDefense" className="h-10 w-auto mb-4" />
          <p className="text-sm leading-relaxed text-gray-500 max-w-xs">
            Enterprise-grade cybersecurity solutions protecting businesses and critical infrastructure from evolving digital threats.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Quick Links</h4>
          <ul className="space-y-2.5">
            {quickLinks.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className="text-sm hover:text-white transition-colors">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Services */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Services</h4>
          <ul className="space-y-2.5">
            {serviceLinks.map((s) => (
              <li key={s} className="text-sm">{s}</li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider">Get in Touch</h4>
          <p className="text-sm mb-2">info@cyberdefense.so</p>
          <Link
            to="/contact"
            className="inline-flex items-center mt-3 px-5 py-2 rounded-full text-xs font-bold text-white bg-[#FF4D2E] hover:bg-[#e6432a] transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>

    {/* Bottom bar */}
    <div className="border-t border-gray-800/50">
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs text-gray-600">© {new Date().getFullYear()} CyberDefense. All rights reserved.</span>
        <div className="flex items-center gap-5 text-xs text-gray-600">
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
