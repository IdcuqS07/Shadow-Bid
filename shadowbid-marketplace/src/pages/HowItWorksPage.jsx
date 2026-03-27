import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Shield, 
  Lock, 
  Eye, 
  Zap, 
  Trophy, 
  DollarSign,
  ArrowRight,
  CheckCircle2,
  Store,
  Users,
  Clock,
  Wallet
} from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/30 px-4 py-2 text-sm text-indigo-300">
          <Shield className="h-4 w-4" />
          <span>Zero-Knowledge Sealed-Bid Auctions</span>
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-white">
          How ShadowBid Works
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Private, fair, and transparent auctions powered by Aleo blockchain
        </p>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-indigo-500/20 bg-slate-800/50">
          <CardContent className="pt-6 text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/20">
              <Lock className="h-6 w-6 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Private Bids</h3>
            <p className="text-sm text-slate-400">
              Your bid amount stays hidden until reveal phase using cryptographic commitments
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-slate-800/50">
          <CardContent className="pt-6 text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20">
              <Zap className="h-6 w-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">O(1) Settlement</h3>
            <p className="text-sm text-slate-400">
              Winner determined in constant time, regardless of number of bidders
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-slate-800/50">
          <CardContent className="pt-6 text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <DollarSign className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Auto Refunds</h3>
            <p className="text-sm text-slate-400">
              Losing bidders automatically receive USDCx refunds in single transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Auction Flow */}
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white">Auction Flow</h2>
          <p className="mt-2 text-slate-400">Complete lifecycle from creation to settlement</p>
        </div>

        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-green-500 hidden md:block" />

          {/* Steps */}
          <div className="space-y-8">
            {/* Step 1: Create Auction */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-indigo-500/20 border-2 border-indigo-500 relative z-10">
                <Store className="h-8 w-8 text-indigo-400" />
              </div>
              <Card className="flex-1 border-indigo-500/20">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">1. Create Auction</h3>
                    <span className="text-xs text-indigo-400 font-semibold">SELLER</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Seller creates auction with minimum bid, closing date, and challenge period (24 hours)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Set min bid in USDCx
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Define closing date
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      On-chain deployment
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Step 2: Commit Bids */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-purple-500/20 border-2 border-purple-500 relative z-10">
                <Lock className="h-8 w-8 text-purple-400" />
              </div>
              <Card className="flex-1 border-purple-500/20">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">2. Commit Bids</h3>
                    <span className="text-xs text-purple-400 font-semibold">BIDDER</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Bidders submit cryptographic commitments with USDCx transfer in single atomic transaction
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Bid amount stays private
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      USDCx auto-escrowed
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Nonce saved locally
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Step 3: Close Auction */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-amber-500/20 border-2 border-amber-500 relative z-10">
                <Clock className="h-8 w-8 text-amber-400" />
              </div>
              <Card className="flex-1 border-amber-500/20">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">3. Close Auction</h3>
                    <span className="text-xs text-amber-400 font-semibold">SELLER</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Seller closes auction after end time, transitioning to reveal phase
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Bidding period ends
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Reveal phase begins
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Step 4: Reveal Bids */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-blue-500/20 border-2 border-blue-500 relative z-10">
                <Eye className="h-8 w-8 text-blue-400" />
              </div>
              <Card className="flex-1 border-blue-500/20">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">4. Reveal Bids</h3>
                    <span className="text-xs text-blue-400 font-semibold">BIDDER</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Bidders reveal their actual bid amounts using saved nonce for verification
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Commitment verified
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Highest bid tracked
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Step 5: Determine Winner */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-pink-500/20 border-2 border-pink-500 relative z-10">
                <Trophy className="h-8 w-8 text-pink-400" />
              </div>
              <Card className="flex-1 border-pink-500/20">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">5. Determine Winner</h3>
                    <span className="text-xs text-pink-400 font-semibold">SELLER</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    Seller determines winner in O(1) operation - highest revealed bid wins instantly
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Constant time O(1)
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Challenge period starts
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Step 6: Finalize & Refund */}
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 flex items-center justify-center h-16 w-16 rounded-full bg-green-500/20 border-2 border-green-500 relative z-10">
                <Wallet className="h-8 w-8 text-green-400" />
              </div>
              <Card className="flex-1 border-green-500/20">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">6. Finalize & Refund</h3>
                    <span className="text-xs text-green-400 font-semibold">SELLER + BIDDERS</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    After 24h challenge period, seller finalizes. Losers claim automatic USDCx refunds
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Winner receives item
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Losers get refunds
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs bg-slate-700/50 px-2 py-1 rounded">
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      Auction settled
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Highlights */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white">Technical Highlights</h2>
          <p className="mt-2 text-slate-400">What makes ShadowBid unique</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-700">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Zero-Knowledge Privacy</h3>
              </div>
              <p className="text-sm text-slate-400">
                Bid amounts remain private during commit phase using cryptographic hash commitments. Only revealed when bidder chooses.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-700">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Scalable Settlement</h3>
              </div>
              <p className="text-sm text-slate-400">
                Winner determination in O(1) time complexity. Whether 10 or 10,000 bidders, settlement takes the same time.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-700">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Atomic Transactions</h3>
              </div>
              <p className="text-sm text-slate-400">
                Bid commitment and USDCx transfer happen in single transaction. Refunds also automatic in one transaction.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-700">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Challenge Period</h3>
              </div>
              <p className="text-sm text-slate-400">
                24-hour challenge period after winner determination ensures fairness and allows dispute resolution if needed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center space-y-6 py-12">
        <h2 className="text-3xl font-bold text-white">Ready to Start?</h2>
        <p className="text-slate-400 max-w-xl mx-auto">
          Create your first sealed-bid auction or participate as a bidder
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to="/create">
            <Button size="lg" className="gap-2">
              <Store className="h-5 w-5" />
              Create Auction
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/auctions">
            <Button size="lg" variant="outline" className="gap-2">
              <Users className="h-5 w-5" />
              Browse Auctions
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
