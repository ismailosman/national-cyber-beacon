import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Zap } from 'lucide-react';
import logoSrc from '@/assets/logo.png';

const NAV_ITEMS = [
  { label: 'Home', href: '/', type: 'scroll', anchor: '#hero' },
  { label: 'About', href: '/', type: 'scroll', anchor: '#about' },
  { label: 'Portfolio', href: '/portfolio', type: 'link' },
  { label: 'Contact', href: '/contact', type: 'link' },
];

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNav = (item: typeof NAV_ITEMS[0]) => {
    setMobileOpen(false);
    if (item.type === 'link') {
      navigate(item.href);
      return;
    }
    // Scroll items
    if (isLanding) {
      const el = document.querySelector(item.anchor!);
      el?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(item.href + (item.anchor || ''));
    }
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-shadow duration-300 bg-gray-950 ${
        scrolled ? 'shadow-md' : ''
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
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                {item.label}
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
          className="md:hidden p-2 text-gray-300"
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
                  className="text-sm font-medium text-gray-300 hover:text-white transition-colors w-full text-left"
                >
                  {item.label}
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
