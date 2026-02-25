import React from 'react';
import SecurityPageLayout from '@/components/landing/SecurityPageLayout';
import { ShieldAlert, Database, RotateCcw, Scan, Lock, AlertTriangle } from 'lucide-react';

const RansomwareProtection: React.FC = () => (
  <SecurityPageLayout
    title="Ransomware Protection"
    subtitle="Threat Neutralization"
    description="Defend your organization against the fastest-growing cyber threat. Our multi-layered ransomware protection detects, contains, and eliminates ransomware attacks before they can encrypt your critical data."
    accentColor="#ff3366"
    features={[
      { icon: ShieldAlert, title: 'Behavioral Detection', description: 'AI-driven behavioral analysis identifies ransomware activity patterns — including file encryption, lateral movement, and privilege escalation — before damage occurs.' },
      { icon: Database, title: 'Immutable Backups', description: 'Air-gapped, immutable backup solutions ensure your data remains recoverable even if primary systems are compromised by sophisticated ransomware variants.' },
      { icon: RotateCcw, title: 'Rapid Recovery', description: 'Pre-planned recovery playbooks and automated restoration workflows minimize downtime, getting your operations back online within hours, not weeks.' },
      { icon: Scan, title: 'Vulnerability Scanning', description: 'Continuous scanning for known ransomware entry vectors including unpatched software, exposed RDP services, and misconfigured cloud storage.' },
      { icon: Lock, title: 'Endpoint Hardening', description: 'Harden endpoints against ransomware with application whitelisting, controlled folder access, and real-time process monitoring on all devices.' },
      { icon: AlertTriangle, title: 'Threat Intelligence', description: 'Integration with global threat feeds to identify emerging ransomware families, IOCs, and TTPs before they reach your network perimeter.' },
    ]}
    benefits={[
      { title: 'Minimize Financial Impact', description: 'The average ransomware payment exceeds $800,000. Prevention is orders of magnitude cheaper than recovery or payment.' },
      { title: 'Protect Operational Continuity', description: 'Ransomware can halt operations for weeks. Multi-layered defense keeps your business running without interruption.' },
      { title: 'Safeguard Reputation', description: 'A ransomware incident can permanently damage customer trust. Proactive protection preserves your brand integrity.' },
      { title: 'Meet Insurance Requirements', description: 'Cyber insurers increasingly require demonstrated ransomware controls. Our solutions help meet and exceed these requirements.' },
    ]}
  />
);

export default RansomwareProtection;
