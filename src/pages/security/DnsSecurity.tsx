import React from 'react';
import SecurityPageLayout from '@/components/landing/SecurityPageLayout';
import { Globe, Shield, Zap, Eye, Lock, Server } from 'lucide-react';

const DnsSecurity: React.FC = () => (
  <SecurityPageLayout
    title="DNS Delivery & Security"
    subtitle="Network Foundation"
    description="Secure the foundation of your internet presence. Our DNS security solutions protect against hijacking, tunneling, and cache poisoning while ensuring ultra-fast, reliable name resolution for your services."
    accentColor="#ff6b35"
    features={[
      { icon: Globe, title: 'DNSSEC Implementation', description: 'Full DNSSEC deployment with automated key management, ensuring DNS responses are authenticated and tamper-proof across your entire domain hierarchy.' },
      { icon: Shield, title: 'DNS Firewall', description: 'Block connections to known malicious domains, preventing malware callbacks, phishing, and data exfiltration through DNS tunneling techniques.' },
      { icon: Zap, title: 'Anycast DNS', description: 'Globally distributed anycast DNS infrastructure delivering sub-10ms resolution times with built-in DDoS resilience and automatic failover.' },
      { icon: Eye, title: 'DNS Monitoring', description: 'Real-time visibility into DNS query patterns, detecting anomalies like domain generation algorithms (DGA), fast-flux, and unauthorized zone transfers.' },
      { icon: Lock, title: 'Registrar Lock', description: 'Multi-layer domain protection with registrar locks, WHOIS privacy, and transfer authorization controls to prevent domain hijacking.' },
      { icon: Server, title: 'Private DNS', description: 'Encrypted DNS resolution (DoH/DoT) for internal networks, preventing eavesdropping and ensuring privacy of DNS queries across your infrastructure.' },
    ]}
    benefits={[
      { title: 'Prevent Domain Hijacking', description: 'DNS hijacking can redirect your entire customer base to attacker-controlled servers. Proper DNS security eliminates this risk.' },
      { title: 'Block Threats at the Network Layer', description: 'DNS-level filtering stops threats before they reach endpoints, reducing load on downstream security controls.' },
      { title: 'Ensure Service Availability', description: 'Resilient DNS infrastructure means your services remain accessible even during targeted attacks on your name servers.' },
      { title: 'Gain Network Visibility', description: 'DNS logs reveal shadow IT, compromised devices, and policy violations that other security tools miss entirely.' },
    ]}
  />
);

export default DnsSecurity;
