import React from 'react';
import SecurityPageLayout from '@/components/landing/SecurityPageLayout';
import { Code, Shield, Bug, Layers, Lock, Activity } from 'lucide-react';

const SecureAppsApis: React.FC = () => (
  <SecurityPageLayout
    title="Secure Apps & APIs"
    subtitle="Application Security"
    description="Protect your applications and APIs from exploitation with comprehensive security testing, runtime protection, and secure development lifecycle integration that catches vulnerabilities before they reach production."
    accentColor="#00cfff"
    features={[
      { icon: Code, title: 'SAST & DAST Testing', description: 'Combine static and dynamic analysis to find vulnerabilities across your application stack — from source code flaws to runtime injection attacks.' },
      { icon: Shield, title: 'API Gateway Security', description: 'Protect APIs with rate limiting, schema validation, authentication enforcement, and anomaly detection to prevent abuse and data leakage.' },
      { icon: Bug, title: 'Penetration Testing', description: 'Expert-led penetration testing of web applications, mobile apps, and API endpoints simulating real-world attack techniques and zero-day exploits.' },
      { icon: Layers, title: 'WAF Protection', description: 'Next-generation web application firewall with custom rulesets, virtual patching, and machine learning to block OWASP Top 10 and beyond.' },
      { icon: Lock, title: 'Secure SDLC', description: 'Integrate security into every phase of development with automated code review, dependency scanning, and security gates in CI/CD pipelines.' },
      { icon: Activity, title: 'Runtime Protection', description: 'Real-time application self-protection (RASP) that detects and blocks attacks from within the application at runtime.' },
    ]}
    benefits={[
      { title: 'Shift Security Left', description: 'Finding vulnerabilities in development costs 100x less than fixing them in production. Integrate security from day one.' },
      { title: 'Protect Customer Data', description: 'Application-layer attacks are the #1 cause of data breaches. Comprehensive app security keeps sensitive data safe.' },
      { title: 'Accelerate Releases', description: "Automated security testing in CI/CD pipelines means security checks don't slow down your deployment velocity." },
      { title: 'Reduce Attack Surface', description: 'Every API endpoint is a potential entry point. Systematic security ensures no endpoint is left unprotected.' },
    ]}
  />
);

export default SecureAppsApis;
