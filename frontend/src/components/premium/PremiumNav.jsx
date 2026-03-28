import { useNavigate } from 'react-router-dom';
import { WalletMultiButton } from '@provablehq/aleo-wallet-adaptor-react-ui';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { Shield, Loader2, Bot, BookOpen } from 'lucide-react';
import PremiumNotificationCenter from '@/components/notifications/PremiumNotificationCenter';

export default function PremiumNav() {
  const navigate = useNavigate();
  const { connecting } = useWallet();

  return (
    <nav className="border-b border-white/5 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-8 py-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-3 group"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-gold-500 to-gold-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Shield className="w-6 h-6 text-void-900" />
            </div>
            <div>
              <div className="text-xl font-display font-bold text-white">ShadowBid</div>
              <div className="text-xs font-mono text-white/40">ALEO AUCTIONS</div>
            </div>
          </button>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/how-it-works')}
              className="hidden lg:inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono uppercase tracking-[0.18em] text-white/75 transition-colors hover:border-white/20 hover:bg-white/10"
            >
              <BookOpen className="h-4 w-4" />
              How It Works
            </button>
            <button
              type="button"
              onClick={() => navigate('/ops')}
              className="hidden lg:inline-flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-mono uppercase tracking-[0.18em] text-cyan-300 transition-colors hover:bg-cyan-500/20"
            >
              <Bot className="h-4 w-4" />
              Ops Console
            </button>
            <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-xs font-mono text-green-400">
              Contract V2.20
            </div>
            <PremiumNotificationCenter />
            <div className="wallet-button-premium relative">
              <WalletMultiButton />
              {connecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-gold-500/20 rounded-xl backdrop-blur-sm pointer-events-none">
                  <Loader2 className="w-4 h-4 text-gold-500 animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
