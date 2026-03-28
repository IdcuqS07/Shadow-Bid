import { useEffect, useRef } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { recordWalletDebug } from '@/wallets/walletDebug';

export default function WalletDiagnostics() {
  const { wallet, address, connected, connecting, disconnecting, reconnecting, network } = useWallet();
  const hasLoggedBoot = useRef(false);

  useEffect(() => {
    if (hasLoggedBoot.current) {
      return;
    }

    hasLoggedBoot.current = true;

    recordWalletDebug('wallet-diagnostics-boot', {
      walletName: wallet?.adapter?.name ?? null,
      address: address ?? null,
      connected,
      connecting,
      disconnecting,
      reconnecting,
      network: network ?? null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
  }, [address, connected, connecting, disconnecting, network, reconnecting, wallet?.adapter?.name]);

  useEffect(() => {
    recordWalletDebug('wallet-diagnostics-state', {
      walletName: wallet?.adapter?.name ?? null,
      address: address ?? null,
      connected,
      connecting,
      disconnecting,
      reconnecting,
      network: network ?? null,
    });
  }, [address, connected, connecting, disconnecting, network, reconnecting, wallet?.adapter?.name]);

  return null;
}

