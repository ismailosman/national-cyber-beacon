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
  <footer className="bg-[hsl(var(--landing-card))] text-[hsl(var(--landing-muted))] border-t border-[hsl(var(--landing-card-border))]">
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div className="sm:col-span-2 lg:col-span-1">
          <img src={logoSrc} alt="CyberDefense" className="h-10 w-auto mb-4" />
          <p className="text-sm leading-relaxed max-w-xs">
            Enterprise-grade cybersecurity solutions protecting businesses and critical infrastructure from evolving digital threats.
          </p>
        </div>

        <div>
          <h4 className="text-[hsl(var(--landing-fg))] font-semibold text-sm mb-4 uppercase tracking-wider">Quick Links</h4>
          <ul className="space-y-2.5">
            {quickLinks.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className="text-sm hover:text-[hsl(var(--landing-fg))] transition-colors">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-[hsl(var(--landing-fg))] font-semibold text-sm mb-4 uppercase tracking-wider">Services</h4>
          <ul className="space-y-2.5">
            {serviceLinks.map((s) => (
              <li key={s} className="text-sm">{s}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-[hsl(var(--landing-fg))] font-semibold text-sm mb-4 uppercase tracking-wider">Get in Touch</h4>
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

    <div className="border-t border-[hsl(var(--landing-card-border))]">
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs">© {new Date().getFullYear()} CyberDefense. All rights reserved.</span>
        <div className="flex items-center gap-5 text-xs">
          <Link to="/privacy" className="hover:text-[hsl(var(--landing-fg))] transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-[hsl(var(--landing-fg))] transition-colors">Terms of Service</Link>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
