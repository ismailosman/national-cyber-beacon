import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Lock, Mail, AlertTriangle } from 'lucide-react';
import logoEmblem from '@/assets/logo-emblem.png';

const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--neon-cyan) / 0.15) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(var(--neon-cyan) / 0.15) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, hsl(var(--neon-cyan)) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src={logoEmblem}
            alt="Somalia Cyber Defence"
            className="w-28 h-28 object-contain mb-4 mx-auto drop-shadow-[0_0_24px_rgba(34,211,238,0.45)]"
          />
          <h1 className="text-2xl font-bold text-glow-cyan text-neon-cyan tracking-widest uppercase">
            Somalia Cyber Defense
          </h1>
          <p className="text-muted-foreground text-sm mt-1 tracking-wider">OBSERVATORY PLATFORM</p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-xl p-8 border border-neon-cyan/20">
          <h2 className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">
            Operator Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="operator@defense.so"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/50 transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-10 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/50 transition-all"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-neon-cyan text-background font-bold rounded-lg hover:brightness-110 transition-all glow-cyan disabled:opacity-50 disabled:cursor-not-allowed tracking-wider uppercase text-sm"
            >
              {loading ? 'Authenticating...' : 'Access System'}
            </button>
          </form>

          <div className="mt-6 space-y-3 text-center">
            <p className="text-xs text-muted-foreground">
              🔒 Authorized Personnel Only — All access is monitored and logged
            </p>
            <Link
              to="/public"
              className="block text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              View public threat dashboard →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
