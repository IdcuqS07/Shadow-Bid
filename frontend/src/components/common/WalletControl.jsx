import { useEffect, useState } from 'react';
import { WalletReadyState } from '@provablehq/aleo-wallet-standard';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { Check, ChevronDown, Loader2, LogOut } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { recordWalletDebug } from '@/wallets/walletDebug';

function shortenAddress(address) {
  if (!address) return null;
  return `${address.slice(0, 4)}..${address.slice(-4)}`;
}

function isSelectableWallet(wallet) {
  return (
    wallet?.readyState === WalletReadyState.INSTALLED ||
    wallet?.readyState === WalletReadyState.LOADABLE
  );
}

export default function WalletControl({ variant = 'standard', className, style }) {
  const {
    wallet,
    wallets,
    address,
    connected,
    connecting,
    disconnecting,
    connect,
    disconnect,
    selectWallet,
  } = useWallet();

  const [open, setOpen] = useState(false);
  const [pendingWalletName, setPendingWalletName] = useState(null);
  const [switchingWallet, setSwitchingWallet] = useState(false);

  const availableWallets = (wallets ?? []).filter((candidate) => isSelectableWallet(candidate));

  const busy = connecting || disconnecting || switchingWallet;
  const currentWalletName = wallet?.adapter?.name ?? null;

  useEffect(() => {
    recordWalletDebug('wallet-control-mounted', {
      surface: variant,
      walletName: currentWalletName,
      connected,
      address: address ?? null,
    });
  }, [variant]);

  useEffect(() => {
    recordWalletDebug('wallet-control-state', {
      surface: variant,
      walletName: currentWalletName,
      connected,
      connecting,
      disconnecting,
      switchingWallet,
      address: address ?? null,
      pendingWalletName,
    });
  }, [
    address,
    connected,
    connecting,
    currentWalletName,
    disconnecting,
    pendingWalletName,
    switchingWallet,
    variant,
  ]);

  useEffect(() => {
    if (!pendingWalletName || busy) {
      return;
    }

    if (wallet?.adapter?.name !== pendingWalletName) {
      return;
    }

    let cancelled = false;

    const runConnect = async () => {
      recordWalletDebug('wallet-control-connect-start', {
        surface: variant,
        walletName: pendingWalletName,
      });

      try {
        await connect();
        recordWalletDebug('wallet-control-connect-success', {
          surface: variant,
          walletName: pendingWalletName,
        });
      } catch (error) {
        recordWalletDebug('wallet-control-connect-error', {
          surface: variant,
          walletName: pendingWalletName,
          error,
        });
        console.error('[WalletControl] Failed to connect selected wallet:', error);
      } finally {
        if (!cancelled) {
          setPendingWalletName(null);
          setSwitchingWallet(false);
        }
      }
    };

    runConnect();

    return () => {
      cancelled = true;
    };
  }, [busy, connect, pendingWalletName, variant, wallet?.adapter?.name]);

  const handleWalletSelect = async (walletName) => {
    if (busy) {
      recordWalletDebug('wallet-control-select-ignored-busy', {
        surface: variant,
        walletName,
      });
      return;
    }

    if (connected && wallet?.adapter?.name === walletName) {
      recordWalletDebug('wallet-control-select-same-wallet', {
        surface: variant,
        walletName,
      });
      setOpen(false);
      return;
    }

    recordWalletDebug('wallet-control-select-wallet', {
      surface: variant,
      walletName,
      currentWalletName,
      connected,
    });

    setOpen(false);
    setSwitchingWallet(true);
    setPendingWalletName(walletName);

    try {
      if (connected) {
        recordWalletDebug('wallet-control-switch-disconnect-start', {
          surface: variant,
          walletName,
          currentWalletName,
        });
        await disconnect();
        recordWalletDebug('wallet-control-switch-disconnect-success', {
          surface: variant,
          walletName,
          currentWalletName,
        });
      }

      selectWallet(walletName);
      recordWalletDebug('wallet-control-select-wallet-success', {
        surface: variant,
        walletName,
      });
    } catch (error) {
      recordWalletDebug('wallet-control-select-wallet-error', {
        surface: variant,
        walletName,
        error,
      });
      console.error('[WalletControl] Failed to switch wallet:', error);
      setPendingWalletName(null);
      setSwitchingWallet(false);
    }
  };

  const handleDisconnect = async () => {
    if (busy || !connected) {
      recordWalletDebug('wallet-control-disconnect-ignored', {
        surface: variant,
        busy,
        connected,
      });
      return;
    }

    setOpen(false);
    setSwitchingWallet(true);

    try {
      recordWalletDebug('wallet-control-disconnect-start', {
        surface: variant,
        walletName: currentWalletName,
      });
      await disconnect();
      recordWalletDebug('wallet-control-disconnect-success', {
        surface: variant,
        walletName: currentWalletName,
      });
    } catch (error) {
      recordWalletDebug('wallet-control-disconnect-error', {
        surface: variant,
        walletName: currentWalletName,
        error,
      });
      console.error('[WalletControl] Failed to disconnect wallet:', error);
    } finally {
      setPendingWalletName(null);
      setSwitchingWallet(false);
    }
  };

  const buttonLabel = busy
    ? 'Connecting...'
    : connected && address
      ? shortenAddress(address)
      : currentWalletName
        ? `Connect ${currentWalletName}`
        : 'Connect Wallet';

  const buttonClasses =
    variant === 'premium'
      ? 'inline-flex min-w-[152px] items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 px-4 py-2.5 text-sm font-semibold text-void-900 shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(212,175,55,0.45)]'
      : 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700/50';

  const popoverClasses =
    variant === 'premium'
      ? 'w-80 border border-white/10 bg-[#101118]/95 p-3 text-white shadow-2xl backdrop-blur-xl'
      : 'w-80 border border-slate-700/70 bg-slate-900/95 p-3 text-white shadow-2xl backdrop-blur-xl';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(buttonClasses, className)}
          disabled={busy}
          style={style}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {!busy && wallet?.adapter?.icon ? (
            <img
              src={wallet.adapter.icon}
              alt={`${wallet.adapter.name} icon`}
              className="h-4 w-4 rounded-[4px]"
            />
          ) : null}
          <span className="max-w-[150px] truncate">{buttonLabel}</span>
          <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(popoverClasses)}
      >
        <div className="space-y-3">
          <div className="space-y-1 border-b border-white/10 pb-3">
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-white/45">
              Wallet Access
            </p>
            <p className="text-sm font-semibold text-white">
              {connected && address ? address : 'Choose a wallet to connect'}
            </p>
          </div>

          <div className="space-y-2">
            {availableWallets.map((candidate) => {
              const candidateName = candidate.adapter.name;
              const selected = currentWalletName === candidateName;

              return (
                <button
                  key={candidateName}
                  type="button"
                  onClick={() => handleWalletSelect(candidateName)}
                  disabled={busy}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:border-gold-500/30 hover:bg-gold-500/10 disabled:opacity-60"
                >
                  <img
                    src={candidate.adapter.icon}
                    alt={`${candidateName} icon`}
                    className="h-9 w-9 rounded-[10px]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{candidateName}</span>
                      {selected ? <Check className="h-4 w-4 text-green-400" /> : null}
                    </div>
                    <div className="text-xs font-mono uppercase tracking-[0.16em] text-white/45">
                      {candidate.readyState}
                    </div>
                  </div>
                </button>
              );
            })}
            {availableWallets.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/60">
                No supported wallet extension detected.
              </div>
            ) : null}
          </div>

          {connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
