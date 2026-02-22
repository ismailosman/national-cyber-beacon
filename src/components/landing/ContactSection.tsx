import React, { useState } from 'react';
import { Send, Mail, MapPin } from 'lucide-react';

const ContactSection: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-20 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">Contact Us</h2>
          <p className="mt-4 text-gray-500 leading-relaxed">
            Ready to secure your infrastructure? Get in touch with our team.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-10 max-w-5xl mx-auto">
          {/* Form */}
          <div className="bg-white rounded-xl border border-gray-100 p-8">
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
                  <Send className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Message Sent</h3>
                <p className="text-sm text-gray-500 mt-2">We'll get back to you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    id="name"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D2E]/40 focus:border-[#FF4D2E]"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D2E]/40 focus:border-[#FF4D2E]"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    id="message"
                    rows={4}
                    required
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FF4D2E]/40 focus:border-[#FF4D2E] resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#FF4D2E] text-white text-sm font-bold hover:bg-[#e6432a] transition-colors"
                >
                  <Send className="w-4 h-4" /> Send Message
                </button>
              </form>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-8 justify-center">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#FF4D2E]/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-[#FF4D2E]" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Email</h3>
                <p className="text-sm text-gray-500 mt-1">info@cyberdefense.so</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#FF4D2E]/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-[#FF4D2E]" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Location</h3>
                <p className="text-sm text-gray-500 mt-1">Mogadishu, Somalia</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
