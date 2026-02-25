import React from 'react';
import SecurityPageLayout from '@/components/landing/SecurityPageLayout';
import { ShieldCheck, FileCheck, Scale, ClipboardList, Eye, Lock } from 'lucide-react';

const CybersecurityCompliance: React.FC = () => (
  <SecurityPageLayout
    title="Cybersecurity Compliance"
    subtitle="Regulatory Alignment"
    description="Navigate the complex landscape of cybersecurity regulations with confidence. We help organizations achieve and maintain compliance with national and international frameworks, reducing legal risk and building stakeholder trust."
    accentColor="#00cf88"
    features={[
      { icon: ShieldCheck, title: 'Framework Mapping', description: 'Map your existing controls to major frameworks including ISO 27001, NIST CSF, PCI-DSS, and local regulatory requirements to identify gaps and prioritize remediation.' },
      { icon: FileCheck, title: 'Automated Assessments', description: 'Continuous, automated compliance assessments that scan your infrastructure, policies, and configurations to generate real-time compliance scorecards.' },
      { icon: Scale, title: 'Regulatory Intelligence', description: 'Stay ahead of evolving regulations with automated tracking of policy updates, ensuring your compliance posture adapts to new requirements.' },
      { icon: ClipboardList, title: 'Audit Preparation', description: 'Streamline audit preparation with pre-built evidence packages, automated documentation, and guided walkthroughs for external assessors.' },
      { icon: Eye, title: 'Continuous Monitoring', description: 'Real-time monitoring of compliance drift with instant alerts when configurations, access controls, or policies fall out of alignment.' },
      { icon: Lock, title: 'Data Governance', description: 'Implement robust data classification, retention, and protection policies that satisfy privacy regulations and data sovereignty requirements.' },
    ]}
    benefits={[
      { title: 'Avoid Costly Penalties', description: 'Non-compliance fines can reach millions. Proactive compliance management protects your bottom line and reputation.' },
      { title: 'Build Customer Trust', description: 'Demonstrable compliance with recognized standards signals maturity and builds confidence with clients and partners.' },
      { title: 'Reduce Audit Fatigue', description: 'Automated evidence collection and continuous monitoring dramatically reduce the time and resources needed for audits.' },
      { title: 'Accelerate Business Growth', description: 'Compliance certifications open doors to regulated industries and government contracts that require verified security posture.' },
    ]}
  />
);

export default CybersecurityCompliance;
