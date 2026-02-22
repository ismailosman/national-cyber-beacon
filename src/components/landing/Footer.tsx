import React from 'react';
import { Link } from 'react-router-dom';
import logoSrc from '@/assets/logo.png';

const Footer: React.FC = () => (
  <footer className="bg-gray-900 text-gray-400 py-12 px-6">
    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <img src={logoSrc} alt="CyberDefense" className="h-7 w-auto brightness-200" />
        <span className="text-sm text-gray-500">© {new Date().getFullYear()} CyberDefense. All rights reserved.</span>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
        <Link to="/cyber-map" className="hover:text-white transition-colors">Live Attack Map</Link>
      </div>
    </div>
  </footer>
);

export default Footer;
