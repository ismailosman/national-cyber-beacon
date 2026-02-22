import React, { useState } from 'react';
import { Send, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import cyberProImg from '@/assets/cyber-professional.jpg';

const SERVICES = [
  'Threat Detection',
  'Real-Time Monitoring',
  'Infrastructure Protection',
  'Incident Response',
  'DAST Scanning',
  'Compliance Assessment',
];

const TITLES = ['CTO', 'CISO', 'IT Manager', 'Security Analyst', 'Other'];

interface FormData {
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  phone: string;
  email: string;
  services: string[];
  country: string;
  orgSize: string;
  comments: string;
}

const initialForm: FormData = {
  firstName: '',
  lastName: '',
  company: '',
  title: '',
  phone: '',
  email: '',
  services: [],
  country: '',
  orgSize: '',
  comments: '',
};

const ContactSection: React.FC = () => {
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleService = (s: string) => {
    setForm(f => ({
      ...f,
      services: f.services.includes(s)
        ? f.services.filter(x => x !== s)
        : [...f.services, s],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-contact-form', {
        body: form,
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-white/30 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/50';

  return (
    <section id="contact" className="bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 min-h-[700px]">
          {/* Left — Info */}
          <div className="bg-[#1a1a2e] text-white p-10 lg:p-16 flex flex-col justify-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-6">
              CyberDefense Security Solutions Evaluation
            </h2>
            <img
              src={cyberProImg}
              alt="Cybersecurity professional"
              className="rounded-xl w-full max-w-sm mb-8 shadow-lg"
            />
            <p className="text-white/70 leading-relaxed mb-4">
              Protect your organization with our comprehensive cybersecurity services — from
              real-time threat monitoring and AI-driven detection to infrastructure hardening
              and incident response.
            </p>
            <p className="text-white/70 leading-relaxed">
              Our team of experts has protected government agencies, financial institutions, and
              critical infrastructure across East Africa.
            </p>
          </div>

          {/* Right — Form */}
          <div className="bg-[#FF4D2E] text-white p-10 lg:p-16 flex flex-col justify-center">
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle className="w-16 h-16 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Request Submitted</h3>
                <p className="text-white/80">Our team will respond within 24 hours.</p>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold mb-1">Submit your consultation request today.</h3>
                <p className="text-white/80 text-sm mb-8">Our team will respond within 24 hours.</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Row: First / Last */}
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      required
                      placeholder="First Name *"
                      value={form.firstName}
                      onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                      className={inputCls}
                    />
                    <input
                      required
                      placeholder="Last Name *"
                      value={form.lastName}
                      onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                      className={inputCls}
                    />
                  </div>

                  {/* Row: Company / Title */}
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      placeholder="Company"
                      value={form.company}
                      onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                      className={inputCls}
                    />
                    <select
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      className={inputCls + ' appearance-none'}
                    >
                      <option value="" className="text-gray-900">Title</option>
                      {TITLES.map(t => (
                        <option key={t} value={t} className="text-gray-900">{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Row: Phone / Email */}
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      placeholder="Phone"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className={inputCls}
                    />
                    <input
                      type="email"
                      required
                      placeholder="Business Email *"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className={inputCls}
                    />
                  </div>

                  {/* Services checkboxes */}
                  <div>
                    <p className="text-sm font-semibold mb-2">Service Interest</p>
                    <div className="grid grid-cols-2 gap-2">
                      {SERVICES.map(s => (
                        <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.services.includes(s)}
                            onChange={() => toggleService(s)}
                            className="rounded border-white/40 accent-white"
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Row: Country / Org Size */}
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      placeholder="Country"
                      value={form.country}
                      onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                      className={inputCls}
                    />
                    <input
                      placeholder="Organization Size"
                      value={form.orgSize}
                      onChange={e => setForm(f => ({ ...f, orgSize: e.target.value }))}
                      className={inputCls}
                    />
                  </div>

                  {/* Comments */}
                  <textarea
                    rows={3}
                    placeholder="Comments"
                    value={form.comments}
                    onChange={e => setForm(f => ({ ...f, comments: e.target.value }))}
                    className={inputCls + ' resize-none'}
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white text-[#FF4D2E] text-sm font-bold hover:bg-white/90 transition-colors disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    {loading ? 'Sending…' : 'Submit Request'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
