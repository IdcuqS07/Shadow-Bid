import { useState, useEffect } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';

const TOKEN_DECIMALS = {
  ALEO: 6,
  USDCx: 6,
  USAD: 6,
};

function extractAtomicUnits(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }

  if (typeof raw === 'bigint') {
    return Number(raw);
  }

  if (typeof raw === 'string') {
    const match = raw.match(/-?\d+/);
    return match ? Number.parseInt(match[0], 10) : null;
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const parsed = extractAtomicUnits(item);
      if (parsed !== null) {
        return parsed;
      }
    }

    return null;
  }

  if (typeof raw === 'object') {
    const prioritizedKeys = ['value', 'amount', 'balance', 'data', 'plaintext'];

    for (const key of prioritizedKeys) {
      if (key in raw) {
        const parsed = extractAtomicUnits(raw[key]);
        if (parsed !== null) {
          return parsed;
        }
      }
    }

    for (const value of Object.values(raw)) {
      const parsed = extractAtomicUnits(value);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function toDisplayBalance(raw, token) {
  const atomicUnits = extractAtomicUnits(raw);
  const decimals = TOKEN_DECIMALS[token] ?? 6;

  if (atomicUnits === null || !Number.isFinite(atomicUnits)) {
    return 0;
  }

  return atomicUnits / (10 ** decimals);
}

export const useMultiCurrencyBalance = () => {
  const { connected, address } = useWallet();
  const [balances, setBalances] = useState({
    ALEO: null,
    USDCx: null,
    USAD: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!connected || !address) {
      console.log('[useMultiCurrencyBalance] Not connected or no address');
      setBalances({
        ALEO: null,
        USDCx: null,
        USAD: null,
      });
      return;
    }

    console.log('[useMultiCurrencyBalance] Fetching balances for:', address);

    const fetchBalances = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        console.log('[useMultiCurrencyBalance] Starting fetch...');
        
        // Fetch Aleo Credits balance
        const aleoRes = await fetch(
          `https://api.explorer.provable.com/v1/testnet/program/credits.aleo/mapping/account/${address}`,
          { signal: controller.signal }
        );
        
        console.log('[useMultiCurrencyBalance] Aleo response status:', aleoRes.status);
        
        let aleoBalance = 0;
        if (aleoRes.ok) {
          try {
            const raw = await aleoRes.json();
            console.log('[useMultiCurrencyBalance] Aleo raw response:', raw);

            const microcredits = extractAtomicUnits(raw);
            console.log('[useMultiCurrencyBalance] Aleo microcredits:', microcredits);

            aleoBalance = toDisplayBalance(raw, 'ALEO');
          } catch (err) {
            console.error('[useMultiCurrencyBalance] Error parsing Aleo balance:', err);
          }
        }

        // Fetch USDCx balance
        const usdcxRes = await fetch(
          `https://api.explorer.provable.com/v1/testnet/program/test_usdcx_stablecoin.aleo/mapping/balances/${address}`,
          { signal: controller.signal }
        );
        
        console.log('[useMultiCurrencyBalance] USDCx response status:', usdcxRes.status);
        
        let usdcxBalance = 0;
        if (usdcxRes.ok) {
          try {
            const raw = await usdcxRes.json();
            console.log('[useMultiCurrencyBalance] USDCx raw response:', raw);

            const microusdcx = extractAtomicUnits(raw);
            console.log('[useMultiCurrencyBalance] USDCx microusdcx:', microusdcx);

            usdcxBalance = toDisplayBalance(raw, 'USDCx');
          } catch (err) {
            console.error('[useMultiCurrencyBalance] Error parsing USDCx balance:', err);
          }
        }

        // Fetch USAD balance
        const usadRes = await fetch(
          `https://api.explorer.provable.com/v1/testnet/program/test_usad_stablecoin.aleo/mapping/balances/${address}`,
          { signal: controller.signal }
        );
        
        console.log('[useMultiCurrencyBalance] USAD response status:', usadRes.status);
        
        let usadBalance = null; // null = coming soon / not available
        if (usadRes.ok) {
          try {
            const raw = await usadRes.json();
            console.log('[useMultiCurrencyBalance] USAD raw response:', raw);

            const microusad = extractAtomicUnits(raw);
            console.log('[useMultiCurrencyBalance] USAD microusad:', microusad);

            usadBalance = toDisplayBalance(raw, 'USAD');
          } catch (err) {
            console.error('[useMultiCurrencyBalance] Error parsing USAD balance:', err);
          }
        } else {
          console.log('[useMultiCurrencyBalance] USAD not available (404 expected if contract not deployed)');
        }

        clearTimeout(timeoutId);
        
        console.log('[useMultiCurrencyBalance] Final balances:', { ALEO: aleoBalance, USDCx: usdcxBalance, USAD: usadBalance });
        
        setBalances({
          ALEO: aleoBalance,
          USDCx: usdcxBalance,
          USAD: usadBalance,
        });
      } catch (err) {
        if (err.name === 'AbortError') {
          console.error('[useMultiCurrencyBalance] Balance fetch timeout');
          setError('Request timeout');
        } else {
          console.error('[useMultiCurrencyBalance] Error fetching balances:', err);
          setError(err.message);
        }
        setBalances({
          ALEO: 0,
          USDCx: 0,
          USAD: null,
        });
      } finally {
        setLoading(false);
        console.log('[useMultiCurrencyBalance] Fetch complete');
      }
    };

    fetchBalances();
    
    // Refresh balances every 30 seconds
    const interval = setInterval(fetchBalances, 30000);
    
    return () => clearInterval(interval);
  }, [connected, address]);

  const formatBalance = (balance, token = 'ALEO') => {
    if (balance === null || balance === undefined) return '---';
    if (isNaN(balance) || !isFinite(balance)) return '0';

    const absoluteBalance = Math.abs(balance);
    const isStablecoin = token === 'USDCx' || token === 'USAD';
    const maximumFractionDigits = absoluteBalance >= 100
      ? 2
      : absoluteBalance >= 1
        ? isStablecoin ? 2 : 4
        : 6;

    return balance.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits,
      useGrouping: true,
    });
  };

  return { 
    balances, 
    loading, 
    error,
    formatBalance,
  };
};
