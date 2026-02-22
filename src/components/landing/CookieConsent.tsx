import React, { useState, useEffect } from 'react';
import { Cookie } from 'lucide-react';

const CookieConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem('cookie_consent', 'dismissed');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-[#FF4D2E]/10 flex items-center justify-center">
            <Cookie className="w-6 h-6 text-[#FF4D2E]" />
          </div>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 text-base mb-1">Help us give you the best experience</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            We use cookies and similar technologies to provide you with a better experience, improve performance, analyze how you interact with our website, and serve relevant content.{' '}
            <button onClick={dismiss} className="underline text-[#FF4D2E] hover:text-[#e6432a] font-medium">
              Our Cookie Policy
            </button>
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={dismiss}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cookie Settings
          </button>
          <button
            onClick={accept}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          >
            Accept All Cookies
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
