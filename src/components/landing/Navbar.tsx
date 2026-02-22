import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Zap } from 'lucide-react';
import logoSrc from '@/assets/logo.png';

const NAV_ITEMS = [
  { label: 'Home', href: '#hero' },
  { label: 'About', href: '#about' },
  { label: 'Portfolio', href: '#portfolio' },
  { label: 'Contact', href: '#contact' },
];

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-shadow duration-300 bg-gray-950 ${
        scrolled ? 'shadow-md' : ''
      }`}
    >
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={logoSrc} alt="CyberDefense" className="h-12 w-auto" />
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map(({ label, href }) => (
            <li key={label}>
              <button
                onClick={() => scrollTo(href)}
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                {label}
              </button>
            </li>
          ))}
          <li>
            <Link
              to="/cyber-map"
              className="flex items-center gap-1.5 text-sm font-bold text-[#FF4D2E] hover:opacity-80 transition-opacity"
            >
              <Zap className="w-4 h-4" />
              LIVE ATTACK
            </Link>
          </li>
        </ul>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-gray-300"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-gray-950 border-t border-gray-800 px-6 pb-4">
          <ul className="flex flex-col gap-4 pt-2">
            {NAV_ITEMS.map(({ label, href }) => (
              <li key={label}>
                <button
                  onClick={() => scrollTo(href)}
                  className="text-sm font-medium text-gray-300 hover:text-white transition-colors w-full text-left"
                >
                  {label}
                </button>
              </li>
            ))}
            <li>
              <Link
                to="/cyber-map"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-1.5 text-sm font-bold text-[#FF4D2E]"
              >
                <Zap className="w-4 h-4" />
                LIVE ATTACK
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
};

export default Navbar;
