import React from 'react';
import SecurityPageLayout from '@/components/landing/SecurityPageLayout';
import { Bot, Fingerprint, ShieldCheck, BarChart3, Blocks, Eye } from 'lucide-react';

const BotProtection: React.FC = () => (
  <SecurityPageLayout
    title="Bot & Abuse Protection"
    subtitle="Automated Threat Defense"
    description="Distinguish legitimate users from malicious bots with precision. Our bot management platform stops credential stuffing, scraping, inventory hoarding, and spam while ensuring real users experience zero friction."
    accentColor="#06b6d4"
    features={[
      { icon: Bot, title: 'Bot Classification', description: 'Machine learning classifies traffic into human, good bot, and bad bot categories with 99.9% accuracy using behavioral fingerprinting and challenge-response.' },
      { icon: Fingerprint, title: 'Device Fingerprinting', description: 'Advanced device and browser fingerprinting detects headless browsers, emulators, and bot frameworks even when they rotate IPs and user agents.' },
      { icon: ShieldCheck, title: 'Credential Stuffing Defense', description: 'Protect login endpoints from automated credential testing using leaked databases, with real-time detection and progressive challenges.' },
      { icon: BarChart3, title: 'Traffic Analytics', description: 'Detailed dashboards showing bot vs. human traffic ratios, attack patterns, and the effectiveness of mitigation rules across your properties.' },
      { icon: Blocks, title: 'Rate Limiting', description: 'Intelligent rate limiting that adapts to traffic patterns, throttling abusive requests while allowing legitimate spikes during sales or events.' },
      { icon: Eye, title: 'Scraping Prevention', description: 'Protect proprietary content, pricing data, and intellectual property from unauthorized automated scraping and competitive intelligence gathering.' },
    ]}
    benefits={[
      { title: 'Protect Account Security', description: 'Credential stuffing attacks compromise thousands of accounts daily. Bot protection stops these attacks at the perimeter.' },
      { title: 'Preserve Infrastructure Costs', description: 'Bad bots can consume up to 40% of web traffic. Blocking them reduces bandwidth and compute costs significantly.' },
      { title: 'Ensure Fair Access', description: 'Prevent bots from hoarding inventory, tickets, or limited resources — ensuring real customers get fair access.' },
      { title: 'Maintain Data Integrity', description: 'Bot traffic pollutes analytics and skews business decisions. Clean traffic means accurate data for better strategy.' },
    ]}
  />
);

export default BotProtection;
