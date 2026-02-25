import React from 'react';
import SecurityPageLayout from '@/components/landing/SecurityPageLayout';
import { ShieldOff, Zap, Globe, BarChart3, Cloud, AlertTriangle } from 'lucide-react';

const DdosProtection: React.FC = () => (
  <SecurityPageLayout
    title="DDoS Protection"
    subtitle="Availability Assurance"
    description="Keep your services online against the most powerful distributed denial-of-service attacks. Our multi-layered DDoS mitigation absorbs volumetric floods, protocol exploits, and application-layer attacks without impacting legitimate traffic."
    accentColor="#f59e0b"
    features={[
      { icon: ShieldOff, title: 'Volumetric Mitigation', description: 'Absorb attacks exceeding 10 Tbps with globally distributed scrubbing centers that filter malicious traffic while passing legitimate requests.' },
      { icon: Zap, title: 'Instant Detection', description: 'Sub-second attack detection using machine learning models trained on millions of DDoS signatures, activating mitigation before impact is felt.' },
      { icon: Globe, title: 'Global Anycast Network', description: "Distribute attack traffic across 300+ global PoPs, eliminating single points of failure and ensuring regional attacks don't affect global availability." },
      { icon: BarChart3, title: 'Attack Analytics', description: 'Detailed post-attack reports with traffic analysis, attack vector breakdown, and recommendations for hardening your infrastructure.' },
      { icon: Cloud, title: 'Cloud-Native Protection', description: 'Native integration with major cloud providers to protect cloud workloads, load balancers, and CDN origins from DDoS at every layer.' },
      { icon: AlertTriangle, title: 'Protocol Defense', description: 'Mitigate SYN floods, UDP amplification, DNS reflection, and other protocol-level attacks with stateful inspection and rate limiting.' },
    ]}
    benefits={[
      { title: 'Guarantee Uptime SLAs', description: 'DDoS attacks are the top cause of unplanned downtime. Always-on protection lets you confidently guarantee 99.99% availability.' },
      { title: 'Protect Revenue', description: 'Every minute of downtime costs money. For e-commerce and financial services, DDoS protection directly protects revenue streams.' },
      { title: 'Maintain Customer Experience', description: 'Users expect instant response times. DDoS mitigation ensures performance remains consistent even during active attacks.' },
      { title: 'Deter Repeat Attacks', description: 'Attackers target easy victims. Demonstrated resilience makes your organization a less attractive target for future campaigns.' },
    ]}
  />
);

export default DdosProtection;
