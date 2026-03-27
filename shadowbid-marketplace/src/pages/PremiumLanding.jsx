import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PremiumButton from '@/components/premium/PremiumButton';
import GlassCard from '@/components/premium/GlassCard';
import PremiumNav from '@/components/premium/PremiumNav';
import { Shield, Zap, Lock, CheckCircle, DollarSign, Package } from 'lucide-react';

export default function PremiumLanding() {
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const features = [
    {
      icon: Shield,
      title: 'Zero-Knowledge Proofs',
      description: 'Bid commitments stay hidden until reveal phase through the V2.20 sealed commit-reveal flow.',
      version: 'V2.20',
    },
    {
      icon: Lock,
      title: 'Sealed-Bid Auctions',
      description: 'No one can see your bid. Fair competition without information asymmetry.',
      version: 'V2.20',
    },
    {
      icon: DollarSign,
      title: '3 Payment Currencies',
      description: 'Create auctions in ALEO, USDCx, or USAD with the active V2.20 contract flow.',
      version: 'V2.20',
    },
    {
      icon: Package,
      title: 'Reserve + Fee Controls',
      description: 'V2.20 adds security hardening, dispute resolution, and keeper-ready lifecycle controls for real-world items.',
      version: 'V2.20',
    },
  ];

  return (
    <div className="min-h-screen bg-void-900 text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Gradient Mesh */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: `
              radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(212, 175, 55, 0.15) 0%, transparent 50%),
              radial-gradient(circle at 20% 30%, rgba(0, 229, 255, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(0, 102, 255, 0.1) 0%, transparent 50%)
            `,
          }}
        />
        
        {/* Grid */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
        
        {/* Noise Texture */}
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')]" />
      </div>

      {/* Navigation */}
      <PremiumNav />

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-20 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-8 animate-fade-in-up">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <span className="text-sm font-mono text-cyan-400 uppercase tracking-wider">
                Powered by Zero-Knowledge
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-7xl md:text-8xl font-display font-bold leading-none">
              <span className="block text-white">Private Sealed-Bid</span>
              <span className="block bg-gradient-to-r from-gold-400 via-gold-500 to-cyan-500 bg-clip-text text-transparent">
                Auctions on Aleo
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
              Maximum privacy. Zero information leakage. Cryptographically verifiable.
              The future of fair auctions is here.
            </p>

            {/* CTA Buttons */}
            <div className="flex items-center justify-center gap-4 pt-8">
              <PremiumButton 
                size="xl"
                onClick={() => navigate('/premium-create')}
              >
                Launch App
              </PremiumButton>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto pt-16">
              {[
                { value: '40%', label: 'Lower Gas Costs' },
                { value: '3', label: 'Currencies' },
                { value: '100%', label: 'Privacy' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-4xl font-display font-bold text-gold-500 mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm font-mono text-white/40 uppercase tracking-wider">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 py-20 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold mb-4">
              Built for Privacy & Fairness
            </h2>
            <p className="text-white/60 font-mono mb-4">
              Contract-backed capabilities only
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <GlassCard 
                key={i} 
                hover
                className="p-8 group relative"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Version Badge */}
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 border border-green-500/40 rounded text-xs font-mono text-green-400 uppercase tracking-wider">
                    <CheckCircle className="w-3 h-3" />
                    {feature.version}
                  </span>
                </div>
                
                <div className="mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-gold-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                    <feature.icon className="w-6 h-6 text-gold-500" />
                  </div>
                </div>
                <h3 className="text-xl font-display font-bold mb-3">
                  {feature.title}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-8">
        <div className="max-w-4xl mx-auto">
          <GlassCard className="p-12 text-center relative overflow-hidden">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-gold-500/10 via-cyan-500/10 to-blue-500/10 animate-pulse" />
            
            <div className="relative z-10 space-y-6">
              <h2 className="text-4xl font-display font-bold">
                Ready to Experience Private Auctions?
              </h2>
              <p className="text-white/60 text-lg">
                Join the future of fair, private, and verifiable auctions on Aleo.
              </p>
              <div className="pt-4">
                <PremiumButton 
                  size="xl"
                  onClick={() => navigate('/premium-create')}
                >
                  Get Started Now
                </PremiumButton>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between text-sm text-white/40 font-mono">
            <div>© 2024 ShadowBid. Built on Aleo.</div>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-white transition-colors">Docs</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
              <a href="#" className="hover:text-white transition-colors">Discord</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
