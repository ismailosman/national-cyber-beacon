import React from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, ArrowRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import CookieConsent from '@/components/landing/CookieConsent';

export interface SecurityFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface SecurityBenefit {
  title: string;
  description: string;
}

interface SecurityPageLayoutProps {
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
  features: SecurityFeature[];
  benefits: SecurityBenefit[];
  ctaText?: string;
}

const SecurityPageLayout: React.FC<SecurityPageLayoutProps> = ({
  title,
  subtitle,
  description,
  accentColor,
  features,
  benefits,
  ctaText = 'Get Protected Today',
}) => (
  <div className="min-h-screen bg-background text-foreground">
    <Navbar />
    <main className="pt-20">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(ellipse at 30% 50%, ${accentColor}33, transparent 60%)`,
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-6"
            style={{ background: `${accentColor}22`, color: accentColor }}
          >
            {subtitle}
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
            {title}
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-gray-400 leading-relaxed">
            {description}
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 bg-muted/40">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-foreground">
            Key Capabilities
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="group rounded-xl border border-border bg-card p-6 hover:shadow-lg transition-all duration-300"
                >
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                    style={{ background: `${accentColor}18` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: accentColor }} />
                  </div>
                  <h3 className="text-lg font-semibold text-card-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-foreground">
            Why It Matters
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {benefits.map((b, i) => (
              <div key={i} className="flex gap-4">
                <div
                  className="mt-1 w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: accentColor }}
                />
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
            Ready to Strengthen Your Defenses?
          </h2>
          <p className="text-muted-foreground mb-8">
            Contact our security experts to learn how we can help protect your organization.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold text-white transition-colors"
            style={{ background: accentColor }}
          >
            {ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </main>
    <Footer />
    <CookieConsent />
  </div>
);

export default SecurityPageLayout;
