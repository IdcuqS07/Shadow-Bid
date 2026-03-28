import "@/App.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppShell } from "@/components/layout/AppShell";
import DashboardPage from "@/pages/DashboardPage";
import AuctionsPage from "@/pages/AuctionsPage";
import AuctionDetailPage from "@/pages/AuctionDetailPage";
import CreateAuctionPage from "@/pages/CreateAuctionPage";
import AdminDashboardV3 from "@/pages/AdminDashboardV3";
import SettlementPage from "@/pages/SettlementPage";
import CommitBidPageV2 from "@/pages/CommitBidPageV2";
import RevealBidPageV2 from "@/pages/RevealBidPageV2";
import HowItWorksPage from "@/pages/HowItWorksPage";
import TestUSDCxTransferPage from "@/pages/TestUSDCxTransferPage";
import PremiumLanding from "@/pages/PremiumLanding";
import PremiumAuctionList from "@/pages/PremiumAuctionList";
import PremiumAuctionDetail from "@/pages/PremiumAuctionDetail";
import PremiumCreateAuction from "@/pages/PremiumCreateAuction";
import WalletDebugPage from "@/pages/WalletDebugPage";
import AdminOnlyRoute from "@/components/auth/AdminOnlyRoute";
import { AleoWalletProvider } from '@provablehq/aleo-wallet-adaptor-react';
import { WalletModalProvider } from '@provablehq/aleo-wallet-adaptor-react-ui';
import { PuzzleWalletAdapter } from '@provablehq/aleo-wallet-adaptor-puzzle';
import { LeoWalletAdapter } from '@provablehq/aleo-wallet-adaptor-leo';
import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield';
import { FoxWalletAdapter } from '@provablehq/aleo-wallet-adaptor-fox';
import { SoterWalletAdapter } from '@provablehq/aleo-wallet-adaptor-soter';
import { Network } from '@provablehq/aleo-types';
import { DecryptPermission } from '@provablehq/aleo-wallet-adaptor-core';
import '@provablehq/aleo-wallet-adaptor-react-ui/dist/styles.css';

const INITIAL_WALLET_PROGRAMS = undefined;
const DEFAULT_WALLET_DECRYPT_PERMISSION = DecryptPermission.NoDecrypt;

function App() {
  return (
    <AleoWalletProvider
      wallets={[
        new ShieldWalletAdapter(),
        new PuzzleWalletAdapter(),
        new LeoWalletAdapter(),
        new FoxWalletAdapter(),
        new SoterWalletAdapter(),
      ]}
      autoConnect={false}
      localNet={false}
      network={Network.TESTNET}
      // Keep the initial wallet handshake minimal so connecting a wallet does
      // not pre-approve decrypt access or program permissions up front.
      decryptPermission={DEFAULT_WALLET_DECRYPT_PERMISSION}
      programs={INITIAL_WALLET_PROGRAMS}
      onError={(error) => {
        console.error('[AleoWalletProvider] Error:', error.message);
        console.error('[AleoWalletProvider] Full error:', error);
      }}
    >
      <WalletModalProvider>
        <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
          <BrowserRouter>
            <Routes>
              {/* Premium Routes - No AppShell (Default) */}
              <Route path="/" element={<PremiumLanding />} />
              <Route path="/premium-auctions" element={<PremiumAuctionList />} />
              <Route path="/premium-auction/:auctionId" element={<PremiumAuctionDetail />} />
              <Route path="/premium-create" element={<PremiumCreateAuction />} />
              <Route path="/wallet-debug" element={<WalletDebugPage />} />
              <Route
                path="/ops"
                element={<AppShell />}
              >
                <Route
                  index
                  element={(
                    <AdminOnlyRoute>
                      <AdminDashboardV3 />
                    </AdminOnlyRoute>
                  )}
                />
              </Route>
              
              {/* Standard Routes - With AppShell */}
              <Route path="/standard" element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="auctions" element={<AuctionsPage />} />
                <Route path="auctions/:auctionId" element={<AuctionDetailPage />} />
                <Route path="create" element={<CreateAuctionPage />} />
                <Route path="commit-bid" element={<CommitBidPageV2 />} />
                <Route path="reveal-bid" element={<RevealBidPageV2 />} />
                <Route path="settlement" element={<SettlementPage />} />
                <Route path="how-it-works" element={<HowItWorksPage />} />
                <Route path="test-usdcx-transfer" element={<TestUSDCxTransferPage />} />
              </Route>

              {/* Legacy standard route redirects */}
              <Route path="/admin-v3" element={<Navigate to="/ops" replace />} />
              <Route path="/standard/admin-v3" element={<Navigate to="/ops" replace />} />
              <Route path="/commit-bid" element={<Navigate to="/standard/commit-bid" replace />} />
              <Route path="/reveal-bid" element={<Navigate to="/standard/reveal-bid" replace />} />
              <Route path="/settlement" element={<Navigate to="/standard/settlement" replace />} />
              <Route path="/how-it-works" element={<Navigate to="/standard/how-it-works" replace />} />
              <Route path="/test-usdcx-transfer" element={<Navigate to="/standard/test-usdcx-transfer" replace />} />
              
              {/* Redirect old routes to standard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </WalletModalProvider>
    </AleoWalletProvider>
  );
}

export default App;
