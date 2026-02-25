import React from 'react';
import SecurityPageLayout from '@/components/landing/SecurityPageLayout';
import { Fingerprint, Network, Shield, Eye, Lock, Users } from 'lucide-react';

const ZeroTrust: React.FC = () => (
  <SecurityPageLayout
    title="Zero Trust Architecture"
    subtitle="Never Trust, Always Verify"
    description="Eliminate implicit trust from your network. Our Zero Trust framework enforces continuous verification of every user, device, and connection — whether inside or outside your perimeter — before granting access to any resource."
    accentColor="#a855f7"
    features={[
      { icon: Fingerprint, title: 'Identity Verification', description: 'Continuous, context-aware authentication combining MFA, biometrics, and behavioral analytics to verify user identity at every access request.' },
      { icon: Network, title: 'Micro-Segmentation', description: 'Divide your network into granular security zones, limiting lateral movement and containing breaches to the smallest possible blast radius.' },
      { icon: Shield, title: 'Device Trust', description: 'Evaluate device health, patch status, and compliance posture in real-time before granting access, rejecting compromised or unmanaged endpoints.' },
      { icon: Eye, title: 'Continuous Monitoring', description: 'Real-time monitoring of all sessions with dynamic policy enforcement that can revoke access instantly when risk signals change.' },
      { icon: Lock, title: 'Least Privilege Access', description: 'Enforce just-in-time, just-enough access policies that grant minimum required permissions and automatically expire elevated privileges.' },
      { icon: Users, title: 'Third-Party Access', description: 'Secure contractor and vendor access with isolated sessions, activity recording, and time-bound permissions without VPN dependencies.' },
    ]}
    benefits={[
      { title: 'Eliminate Lateral Movement', description: 'Even if an attacker breaches one segment, micro-segmentation prevents them from reaching critical assets elsewhere in your network.' },
      { title: 'Enable Secure Remote Work', description: 'Zero Trust removes the need for VPNs, providing secure access to any resource from any location on any device.' },
      { title: 'Reduce Insider Threats', description: 'Continuous verification and least-privilege access minimize the damage that compromised or malicious insiders can cause.' },
      { title: 'Simplify Compliance', description: 'Zero Trust architectures inherently satisfy many regulatory requirements around access control, monitoring, and data protection.' },
    ]}
  />
);

export default ZeroTrust;
