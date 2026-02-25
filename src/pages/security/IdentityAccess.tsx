import React from 'react';
import SecurityPageLayout from '@/components/landing/SecurityPageLayout';
import { KeyRound, Users, Shield, Eye, Fingerprint, Lock } from 'lucide-react';

const IdentityAccess: React.FC = () => (
  <SecurityPageLayout
    title="Identity, Credential & Access Management"
    subtitle="IAM Solutions"
    description="Centralize identity governance and enforce granular access controls across your entire digital ecosystem. From single sign-on to privileged access management, ensure the right people access the right resources at the right time."
    accentColor="#ec4899"
    features={[
      { icon: KeyRound, title: 'Single Sign-On (SSO)', description: 'Unified authentication across all applications with SAML, OIDC, and OAuth support — reducing password fatigue and improving user experience.' },
      { icon: Users, title: 'Identity Governance', description: 'Automated lifecycle management for user identities including provisioning, role changes, and de-provisioning with full audit trails.' },
      { icon: Shield, title: 'Privileged Access Management', description: 'Secure, monitor, and audit privileged accounts with session recording, just-in-time elevation, and automated credential rotation.' },
      { icon: Eye, title: 'Access Reviews', description: 'Automated periodic access certifications that flag excessive permissions, orphaned accounts, and segregation-of-duty violations for review.' },
      { icon: Fingerprint, title: 'Multi-Factor Authentication', description: 'Adaptive MFA that adjusts authentication requirements based on risk signals including location, device, behavior, and resource sensitivity.' },
      { icon: Lock, title: 'Credential Vault', description: 'Enterprise-grade secrets management for API keys, certificates, and service accounts with automatic rotation and access logging.' },
    ]}
    benefits={[
      { title: 'Prevent Identity-Based Attacks', description: 'Over 80% of breaches involve compromised credentials. Strong IAM is the single most impactful security investment you can make.' },
      { title: 'Streamline User Experience', description: 'SSO and adaptive MFA reduce login friction, improving productivity while maintaining security across all applications.' },
      { title: 'Achieve Regulatory Compliance', description: 'IAM controls satisfy requirements across ISO 27001, SOC 2, HIPAA, and virtually every compliance framework.' },
      { title: 'Reduce Operational Overhead', description: 'Automated provisioning and access reviews eliminate manual identity management tasks that consume IT resources.' },
    ]}
  />
);

export default IdentityAccess;
