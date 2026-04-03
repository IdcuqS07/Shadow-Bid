import { DecryptPermission } from '@provablehq/aleo-wallet-adaptor-core';

export const WALLET_PERMISSION_STORAGE_KEY = 'shadowbidWalletDecryptPermission';

function isKnownPermission(value) {
  return value === DecryptPermission.NoDecrypt
    || value === DecryptPermission.UponRequest
    || value === DecryptPermission.AutoDecrypt
    || value === DecryptPermission.OnChainHistory;
}

export function getStoredWalletDecryptPermission() {
  if (typeof window === 'undefined') {
    return DecryptPermission.UponRequest;
  }

  const storedValue = window.localStorage.getItem(WALLET_PERMISSION_STORAGE_KEY);
  return isKnownPermission(storedValue) ? storedValue : DecryptPermission.UponRequest;
}

export function setStoredWalletDecryptPermission(permission) {
  if (typeof window === 'undefined' || !isKnownPermission(permission)) {
    return;
  }

  window.localStorage.setItem(WALLET_PERMISSION_STORAGE_KEY, permission);
}

export function clearStoredWalletDecryptPermission() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(WALLET_PERMISSION_STORAGE_KEY);
}

export function getWalletDecryptPermissionLabel(permission) {
  switch (permission) {
    case DecryptPermission.NoDecrypt:
      return 'NO_DECRYPT';
    case DecryptPermission.AutoDecrypt:
      return 'AUTO_DECRYPT';
    case DecryptPermission.OnChainHistory:
      return 'ON_CHAIN_HISTORY';
    case DecryptPermission.UponRequest:
    default:
      return 'DECRYPT_UPON_REQUEST';
  }
}
