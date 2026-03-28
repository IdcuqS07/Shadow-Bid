import { useState, useEffect } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';

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
            
            // Handle different response formats
            let microcredits = 0;
            if (typeof raw === 'number') {
              microcredits = raw;
            } else if (typeof raw === 'string') {
              microcredits = parseInt(raw.replace(/[^0-9]/g, ''), 10);
            } else if (raw && typeof raw === 'object') {
              // If response is an object, try to extract the value
              microcredits = parseInt(String(raw.value || raw.amount || raw).replace(/[^0-9]/g, ''), 10);
            }
            
            console.log('[useMultiCurrencyBalance] Aleo microcredits:', microcredits);
            
            if (!isNaN(microcredits) && isFinite(microcredits)) {
              aleoBalance = microcredits / 1_000_000;
            }
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
            
            // Handle different response formats
            let microusdcx = 0;
            if (typeof raw === 'number') {
              microusdcx = raw;
            } else if (typeof raw === 'string') {
              microusdcx = parseInt(raw.replace(/[^0-9]/g, ''), 10);
            } else if (raw && typeof raw === 'object') {
              // If response is an object, try to extract the value
              microusdcx = parseInt(String(raw.value || raw.amount || raw).replace(/[^0-9]/g, ''), 10);
            }
            
            console.log('[useMultiCurrencyBalance] USDCx microusdcx:', microusdcx);
            
            if (!isNaN(microusdcx) && isFinite(microusdcx)) {
              usdcxBalance = microusdcx / 1_000_000;
            }
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
            
            // Handle different response formats
            let microusad = 0;
            if (typeof raw === 'number') {
              microusad = raw;
            } else if (typeof raw === 'string') {
              microusad = parseInt(raw.replace(/[^0-9]/g, ''), 10);
            } else if (raw && typeof raw === 'object') {
              // If response is an object, try to extract the value
              microusad = parseInt(String(raw.value || raw.amount || raw).replace(/[^0-9]/g, ''), 10);
            }
            
            console.log('[useMultiCurrencyBalance] USAD microusad:', microusad);
            
            if (!isNaN(microusad) && isFinite(microusad)) {
              usadBalance = microusad / 1_000_000;
            }
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

  const formatBalance = (balance) => {
    if (balance === null || balance === undefined) return '---';
    if (isNaN(balance) || !isFinite(balance)) return '0.00';
    return balance.toLocaleString('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  };

  return { 
    balances, 
    loading, 
    error,
    formatBalance,
  };
};
