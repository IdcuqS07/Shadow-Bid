import { useNavigate } from 'react-router-dom';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { WalletMultiButton } from '@provablehq/aleo-wallet-adaptor-react-ui';
import { Shield, Loader2, Bot, ExternalLink } from 'lucide-react';
import PremiumNotificationCenter from '@/components/notifications/PremiumNotificationCenter';

const CONTRACT_PROGRAM_ID = import.meta.env.VITE_PROGRAM_ID || 'shadowbid_marketplace_v2_24.aleo';
const CONTRACT_VERSION_LABEL = (() => {
  const versionMatch = CONTRACT_PROGRAM_ID.match(/shadowbid_marketplace_v(\d+)_(\d+)\.aleo/i);
  return versionMatch ? `V${versionMatch[1]}.${versionMatch[2]}` : 'Current';
})();
const CONTRACT_EXPLORER_URL = `https://testnet.explorer.provable.com/program/${CONTRACT_PROGRAM_ID}`;

export default function PremiumNav() {
  const navigate = useNavigate();
  const { connecting } = useWallet();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-void-900/88 backdrop-blur-2xl">
      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 xl:px-8">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/')}
            className="group flex min-w-0 items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 shadow-[0_14px_32px_rgba(212,175,55,0.22)] transition-transform duration-300 group-hover:-translate-y-0.5">
              <Shield className="h-5 w-5 text-void-900" />
            </div>
            <div className="min-w-0 text-left">
              <div className="text-lg font-display font-bold text-white sm:text-xl">ShadowBid</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/38 sm:text-[11px]">
                Aleo Private Auctions
              </div>
            </div>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate('/ops')}
              className="hidden xl:inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-mono uppercase tracking-[0.16em] text-cyan-300 transition-colors hover:border-cyan-500/25 hover:bg-cyan-500/10"
            >
              <Bot className="h-3.5 w-3.5" />
              Ops Console
            </button>

            <a
              href={CONTRACT_EXPLORER_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center gap-2 rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-2 text-[11px] font-mono uppercase tracking-[0.16em] text-green-400 transition-colors hover:border-green-400/40 hover:bg-green-500/15 hover:text-green-300"
              title={`View ShadowBid ${CONTRACT_VERSION_LABEL} on Provable Explorer`}
            >
              Contract {CONTRACT_VERSION_LABEL}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <PremiumNotificationCenter />

            <div className="wallet-button-premium relative">
              <WalletMultiButton />
              {connecting && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-gold-500/20 backdrop-blur-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-gold-500" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
