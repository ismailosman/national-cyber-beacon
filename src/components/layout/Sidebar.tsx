import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Bell, FileText, Settings,
  LogOut, ChevronRight, Wifi, AlertOctagon, CheckSquare, Map, Activity, ShieldAlert, Radar, Crosshair, Search, Shield, ListOrdered, Eye, ScanSearch
} from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/organizations', icon: Building2, label: 'Organizations' },
  { to: '/alerts', icon: Bell, label: 'Alert Center' },
  { to: '/incidents', icon: AlertOctagon, label: 'Incidents' },
  { to: '/compliance', icon: CheckSquare, label: 'Compliance' },
  { to: '/compliance-scan', icon: ScanSearch, label: 'Compliance Scan' },
  
  { to: '/threat-map', icon: Map, label: 'Threat Map' },
  { to: '/uptime', icon: Activity, label: 'Uptime Monitor' },
  { to: '/ddos-monitor', icon: ShieldAlert, label: 'DDoS Monitor' },
  { to: '/early-warning', icon: Radar, label: 'Early Warning' },
  { to: '/threat-intelligence', icon: Crosshair, label: 'Threat Intel' },
  { to: '/dark-web', icon: Eye, label: 'Dark Web Monitor' },
  { to: '/dast-scanner', icon: Search, label: 'DAST Scanner' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  
  { to: '/admin/security-monitor', icon: Shield, label: 'Security Monitor' },
  { to: '/security-scanner', icon: Search, label: 'Security Scanner' },
  { to: '/scan-queue', icon: ListOrdered, label: 'Scan Queue' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const roleColors: Record<string, string> = {
  SuperAdmin: 'text-neon-cyan border-neon-cyan/40 bg-neon-cyan/10',
  OrgAdmin: 'text-neon-blue border-neon-blue/40 bg-neon-blue/10',
  Analyst: 'text-neon-green border-neon-green/40 bg-neon-green/10',
  Auditor: 'text-neon-amber border-neon-amber/40 bg-neon-amber/10',
};

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/mol');
  };

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center">
          <img src={logoImg} alt="Somalia Cyber Defence" className="w-36 object-contain" />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <div className="w-2 h-2 rounded-full bg-neon-green animate-blink" />
          <span className="text-xs text-neon-green font-mono">SYSTEM ONLINE</span>
          <Wifi className="w-3 h-3 text-neon-green ml-auto" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('w-4 h-4', isActive ? 'text-neon-cyan' : 'text-muted-foreground group-hover:text-foreground')} />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight className="w-3 h-3 text-neon-cyan" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-sidebar-border">
        {userRole && (
          <div className={cn('text-xs px-2 py-1 rounded border font-mono mb-2 inline-block', roleColors[userRole.role] || 'text-muted-foreground')}>
            {userRole.role}
          </div>
        )}
        <div className="text-xs text-muted-foreground truncate mb-2">{user?.email}</div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors w-full"
        >
          <LogOut className="w-3 h-3" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
