import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Zap, ChevronDown } from 'lucide-react';
import logoSrc from '@/assets/logo.png';
import ThemeToggle from '@/components/ThemeToggle';

const SECURITY_ITEMS = [
  { label: 'Cybersecurity Compliance', href: '/security/cybersecurity-compliance' },
  { label: 'Ransomware Protection', href: '/security/ransomware-protection' },
  { label: 'Secure Apps & APIs', href: '/security/secure-apps-apis' },
  { label: 'DNS Delivery & Security', href: '/security/dns-security' },
  { label: 'Zero Trust', href: '/security/zero-trust' },
  { label: 'DDoS Protection', href: '/security/ddos-protection' },
  { label: 'Bot & Abuse Protection', href: '/security/bot-protection' },
  { label: 'Identity & Access Management', href: '/security/identity-access' },
];

const NAV_ITEMS = [
  { label: 'Home', href: '/', type: 'scroll', anchor: '#hero' },
  { label: 'About', href: '/', type: 'scroll', anchor: '#about' },
  { label: 'Portfolio', href: '/portfolio', type: 'link' },
  { label: 'Contact', href: '/contact', type: 'link' },
];

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [mobileSecurityOpen, setMobileSecurityOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === '/';
  const dropdownRef = useRef<HTMLLIElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMobileSecurityOpen(false);
  }, [location.pathname]);

  const handleNav = (item: typeof NAV_ITEMS[0]) => {
    setMobileOpen(false);
    if (item.type === 'link') { navigate(item.href); return; }
    if (isLanding) {
      const el = document.querySelector(item.anchor!);
      el?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(item.href + (item.anchor || ''));
    }
  };

  const handleDropdownEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSecurityOpen(true);
  };

  const handleDropdownLeave = () => {
    timeoutRef.current = setTimeout(() => setSecurityOpen(false), 150);
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 bg-gray-950 ${
        scrolled ? 'shadow-md border-b border-gray-800' : ''
      }`}
    >
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoSrc} alt="CyberDefense" className="h-12 w-auto" />
        </Link>

        <ul className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <button
                onClick={() => handleNav(item)}
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                {item.label}
              </button>
            </li>
          ))}

          {/* Security Dropdown */}
          <li
            ref={dropdownRef}
            className="relative"
            onMouseEnter={handleDropdownEnter}
            onMouseLeave={handleDropdownLeave}
          >
            <button className="flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-white transition-colors">
              Security
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${securityOpen ? 'rotate-180' : ''}`} />
            </button>
            {securityOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50">
                <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-xl py-2 w-64">
                  {SECURITY_ITEMS.map((s) => (
                    <Link
                      key={s.href}
                      to={s.href}
                      onClick={() => setSecurityOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-950 transition-colors"
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </li>

          <li>
            <Link
              to="/cyber-map"
              className="flex items-center gap-1.5 text-sm font-bold text-[#FF4D2E] hover:opacity-80 transition-opacity"
            >
              <Zap className="w-4 h-4" />
              LIVE ATTACK
            </Link>
          </li>
          <li>
            <ThemeToggle />
          </li>
          <li>
            <Link
              to="/contact"
              className="inline-flex items-center px-5 py-2 rounded-full text-xs font-bold text-white bg-[#FF4D2E] hover:bg-[#e6432a] transition-colors"
            >
              Secure Your Business
            </Link>
          </li>
        </ul>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-gray-400 md:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden bg-gray-950 border-t border-gray-800 px-6 pb-4">
          <ul className="flex flex-col gap-4 pt-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <button
                  onClick={() => handleNav(item)}
                  className="text-sm font-medium text-gray-400 hover:text-white transition-colors w-full text-left"
                >
                  {item.label}
                </button>
              </li>
            ))}

            {/* Mobile Security Accordion */}
            <li>
              <button
                onClick={() => setMobileSecurityOpen(!mobileSecurityOpen)}
                className="flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-white transition-colors w-full text-left"
              >
                Security
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${mobileSecurityOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileSecurityOpen && (
                <ul className="mt-2 ml-4 flex flex-col gap-2">
                  {SECURITY_ITEMS.map((s) => (
                    <li key={s.href}>
                      <Link
                        to={s.href}
                        onClick={() => setMobileOpen(false)}
                        className="block text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>

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
            <li>
              <ThemeToggle />
            </li>
          </ul>
        </div>
      )}
    </header>
  );
};

export default Navbar;
