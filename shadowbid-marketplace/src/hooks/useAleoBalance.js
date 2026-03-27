import { useState, useEffect } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';

export const useAleoBalance = () => {
  const { connected, address } = useWallet();
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!connected || !address) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `https://api.explorer.provable.com/v1/testnet/program/credits.aleo/mapping/account/${address}`
        );
        if (!res.ok) throw new Error('Failed to fetch balance');
        const raw = await res.json();
        const microcredits = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
        const credits = microcredits / 1_000_000;
        setBalance(credits);
      } catch (err) {
        setError(err.message);
        setBalance(0);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [connected, address]);

  const formatted = balance !== null
    ? `${balance.toLocaleString('en-US', { maximumFractionDigits: 2 })} credits`
    : null;

  return { balance, formatted, loading, error };
};
