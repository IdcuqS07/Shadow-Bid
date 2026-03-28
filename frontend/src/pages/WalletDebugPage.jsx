import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { WalletMultiButton } from '@provablehq/aleo-wallet-adaptor-react-ui';
import { useEffect, useState } from 'react';

export default function WalletDebugPage() {
  const { connected, connecting, wallet, wallets, address, publicKey, select } = useWallet();
  const [detectedWallets, setDetectedWallets] = useState([]);

  useEffect(() => {
    // Check for wallet extensions in window object
    const detected = [];
    
    if (window.shield) detected.push('Shield Wallet');
    if (window.puzzle) detected.push('Puzzle Wallet');
    if (window.leo) detected.push('Leo Wallet');
    if (window.foxwallet) detected.push('Fox Wallet');
    if (window.soter) detected.push('Soter Wallet');
    
    setDetectedWallets(detected);
    
    console.log('[WalletDebug] Window object keys:', Object.keys(window).filter(k => k.includes('wallet') || k.includes('aleo')));
    console.log('[WalletDebug] Detected wallets:', detected);
    console.log('[WalletDebug] Available wallets from provider:', wallets?.map(w => w.name));
  }, [wallets]);

  return (
    <div className="min-h-screen bg-void-900 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold mb-8">Wallet Debug Page</h1>
        
        {/* Wallet Button */}
        <div className="p-6 bg-void-800 rounded-xl border border-white/10">
          <h2 className="text-xl font-bold mb-4">Connect Wallet</h2>
          <WalletMultiButton />
        </div>

        {/* Connection Status */}
        <div className="p-6 bg-void-800 rounded-xl border border-white/10">
          <h2 className="text-xl font-bold mb-4">Connection Status</h2>
          <div className="space-y-2 font-mono text-sm">
            <div>Connected: <span className={connected ? 'text-green-400' : 'text-red-400'}>{String(connected)}</span></div>
            <div>Connecting: <span className={connecting ? 'text-yellow-400' : 'text-white/60'}>{String(connecting)}</span></div>
            <div>Address: <span className="text-cyan-400">{address || 'null'}</span></div>
            <div>Public Key: <span className="text-cyan-400">{publicKey || 'null'}</span></div>
            <div>Current Wallet: <span className="text-gold-500">{wallet?.name || 'null'}</span></div>
          </div>
        </div>

        {/* Detected Wallets */}
        <div className="p-6 bg-void-800 rounded-xl border border-white/10">
          <h2 className="text-xl font-bold mb-4">Detected Wallet Extensions</h2>
          {detectedWallets.length > 0 ? (
            <ul className="space-y-2">
              {detectedWallets.map((w, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  <span className="font-mono">{w}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-red-400">No wallet extensions detected in window object</p>
          )}
        </div>

        {/* Available Wallets from Provider */}
        <div className="p-6 bg-void-800 rounded-xl border border-white/10">
          <h2 className="text-xl font-bold mb-4">Available Wallets (from Provider)</h2>
          {wallets && wallets.length > 0 ? (
            <ul className="space-y-2">
              {wallets.map((w, i) => (
                <li key={i} className="flex items-center gap-4">
                  <span className="font-mono">{w.name}</span>
                  <span className={`text-xs px-2 py-1 rounded ${w.readyState === 'Installed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {w.readyState}
                  </span>
                  {w.readyState === 'Installed' && (
                    <button
                      onClick={() => select(w.name)}
                      className="text-xs px-3 py-1 bg-gold-500 text-void-900 rounded hover:bg-gold-400"
                    >
                      Select
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-white/60">No wallets available</p>
          )}
        </div>

        {/* Instructions */}
        <div className="p-6 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
          <h2 className="text-xl font-bold mb-4 text-cyan-400">Troubleshooting</h2>
          <ol className="space-y-2 text-sm list-decimal list-inside">
            <li>Make sure you have an Aleo wallet extension installed (Shield recommended, or Puzzle / Leo / Fox / Soter)</li>
            <li>Check that the wallet extension is enabled in your browser</li>
            <li>Refresh this page after installing/enabling wallet</li>
            <li>Try clicking "Select Wallet" button above</li>
            <li>Check browser console for errors (F12)</li>
            <li>If wallet shows "NotDetected", the extension is not installed or not enabled</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
