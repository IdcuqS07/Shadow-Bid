import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Eye,
  Lock,
  Scale,
  Shield,
  Store,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import GlassCard from '@/components/premium/GlassCard';
import PremiumButton from '@/components/premium/PremiumButton';
import PremiumNav from '@/components/premium/PremiumNav';

const contractPillars = [
  {
    icon: Lock,
    title: 'Sealed Commit-Reveal',
    description: 'Bid amounts stay hidden during bidding and only become comparable after a valid reveal.',
  },
  {
    icon: Wallet,
    title: 'Three Settlement Currencies',
    description: 'V2.21 auctions run with ALEO, USDCx, or USAD while keeping one consistent lifecycle.',
  },
  {
    icon: Scale,
    title: 'Reserve and Dispute Protection',
    description: 'Reserve checks, challenge handling, and dispute transitions are built into the contract-aware flow.',
  },
  {
    icon: Bot,
    title: 'Ops-Ready Lifecycle',
    description: 'Premium pages sync auction snapshots into the operations layer for analytics, executor scans, and admin review.',
  },
];

const lifecycleSteps = [
  {
    icon: Store,
    role: 'Seller',
    title: 'Create an auction',
    description:
      'The seller sets the minimum bid, optional reserve, accepted currency, asset type, closing time, and challenge-ready metadata.',
    bullets: [
      'Supports ALEO, USDCx, and USAD',
      'Reserve logic is enforced during settlement',
      'Seller profile and proof roots can be anchored for V2.21 verification workflows',
    ],
  },
  {
    icon: Lock,
    role: 'Bidder',
    title: 'Submit a sealed bid',
    description:
      'Each bidder commits privately to a value and locks funds through the active V2.21 commit path.',
    bullets: [
      'The bid amount remains private during the commit phase',
      'Escrow is locked on-chain with the commitment',
      'Reveal material is retained locally for the bidder to use later',
    ],
  },
  {
    icon: Clock3,
    role: 'Seller',
    title: 'Close bidding',
    description:
      'Once the end time is reached, the seller closes the auction and the reveal phase begins.',
    bullets: [
      'New commits stop at this point',
      'The reveal window becomes the active phase',
      'Cancellation remains limited to the zero-escrow scenario',
    ],
  },
  {
    icon: Eye,
    role: 'Bidder',
    title: 'Reveal committed bids',
    description:
      'Bidders reveal the committed amount and proof material so the contract can validate each bid.',
    bullets: [
      'Only valid reveals are counted',
      'The highest revealed bid becomes eligible to win',
      'Unrevealed commitments cannot overtake valid revealed bids',
    ],
  },
  {
    icon: Trophy,
    role: 'Seller',
    title: 'Settle after reveal timeout',
    description:
      'After the reveal window ends, the seller settles the closed auction so the contract either moves into challenge or cancels deterministically.',
    bullets: [
      'Reserve checks are applied during timeout settlement',
      'Successful settlements move into the dispute-ready challenge phase',
      'No-valid-reveal or reserve-miss cases can cancel cleanly instead of stalling',
    ],
  },
  {
    icon: Wallet,
    role: 'All parties',
    title: 'Settle claims and payouts',
    description:
      'The auction either finalizes successfully or exits through reserve/dispute handling, then post-settlement claims become available.',
    bullets: [
      'Seller claims the net proceeds after receipt or timeout conditions are met',
      'Losing bidders claim refunds when eligible',
      'Platform fee is claimed after seller payout, not before',
    ],
  },
];

const stateCards = [
  {
    name: 'OPEN',
    tone: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
    description: 'Auction accepts private commitments and can still be cancelled only while escrow is zero.',
  },
  {
    name: 'CLOSED',
    tone: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    description: 'Commit phase has ended and the reveal stage is active.',
  },
  {
    name: 'CHALLENGE',
    tone: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
    description: 'A winner has been determined and the auction is waiting for its final settlement path.',
  },
  {
    name: 'SETTLED',
    tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    description: 'The winner path has completed and downstream payout and fee claims can proceed.',
  },
  {
    name: 'DISPUTED',
    tone: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    description: 'Admin dispute resolution is required before the auction can finish cleanly.',
  },
];

const roleCards = [
  {
    icon: Store,
    title: 'Seller responsibilities',
    items: [
      'Create the auction with the correct reserve, currency, and evidence metadata',
      'Close bidding, then determine the winner after bidders reveal',
      'Finalize or cancel according to reserve and dispute outcomes',
    ],
  },
  {
    icon: Users,
    title: 'Bidder responsibilities',
    items: [
      'Commit before the auction closes',
      'Reveal with the correct local secret during the reveal window',
      'Claim a refund if the bid loses or the reserve is not met',
    ],
  },
  {
    icon: Shield,
    title: 'Platform responsibilities',
    items: [
      'Monitor lifecycle health through Ops Console',
      'Resolve disputes from the platform-owner wallet only',
      'Claim the platform fee only after seller payout is complete',
    ],
  },
];

export default function PremiumHowItWorks() {
  const navigate = useNavigate();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (event) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-void-900 text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `
              radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(212, 175, 55, 0.14) 0%, transparent 48%),
              radial-gradient(circle at 18% 22%, rgba(0, 229, 255, 0.10) 0%, transparent 40%),
              radial-gradient(circle at 78% 70%, rgba(0, 102, 255, 0.12) 0%, transparent 42%)
            `,
          }}
        />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
            `,
            backgroundSize: '42px 42px',
          }}
        />
      </div>

      <PremiumNav />

      <section className="relative z-10 px-8 pb-16 pt-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] text-cyan-300">
              <Shield className="h-4 w-4" />
              Contract V2.21 Lifecycle
            </div>
            <h1 className="mt-6 text-5xl font-display font-bold leading-tight md:text-7xl">
              How ShadowBid Works
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/65">
              This premium flow follows the live V2.21 contract: sealed commits, verified reveals,
              challenge-aware settlement, dispute readiness, and post-settlement claims for sellers,
              bidders, and the platform owner.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <PremiumButton size="lg" onClick={() => navigate('/premium-auctions')}>
                Browse Premium Auctions
              </PremiumButton>
              <PremiumButton variant="secondary" size="lg" onClick={() => navigate('/premium-create')}>
                Create an Auction
              </PremiumButton>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-8 py-8">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-4">
          {contractPillars.map((pillar) => (
            <GlassCard key={pillar.title} hover className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-500/20 to-cyan-500/20">
                <pillar.icon className="h-6 w-6 text-gold-400" />
              </div>
              <h2 className="mt-5 text-xl font-display font-bold text-white">{pillar.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/65">{pillar.description}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-8 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-mono uppercase tracking-[0.25em] text-cyan-300">Lifecycle</p>
            <h2 className="mt-3 text-4xl font-display font-bold text-white md:text-5xl">
              The V2.21 auction flow from creation to settlement
            </h2>
            <p className="mt-4 text-white/60">
              Each step below reflects the current product behavior in premium pages, settlement actions,
              and the operations layer.
            </p>
          </div>

          <div className="mt-12 space-y-5">
            {lifecycleSteps.map((step, index) => (
              <GlassCard key={step.title} className="p-6 md:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-start">
                  <div className="flex items-center gap-4 md:w-72 md:flex-col md:items-start md:gap-5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                      <step.icon className="h-7 w-7 text-gold-400" />
                    </div>
                    <div>
                      <div className="text-xs font-mono uppercase tracking-[0.22em] text-cyan-300">
                        Step {index + 1} · {step.role}
                      </div>
                      <h3 className="mt-2 text-2xl font-display font-bold text-white">{step.title}</h3>
                    </div>
                  </div>

                  <div className="flex-1">
                    <p className="text-base leading-7 text-white/70">{step.description}</p>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {step.bullets.map((item) => (
                        <div
                          key={item}
                          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75"
                        >
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                            <span>{item}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-8 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <GlassCard className="p-8">
              <p className="text-sm font-mono uppercase tracking-[0.25em] text-cyan-300">Contract States</p>
              <h2 className="mt-3 text-3xl font-display font-bold text-white">What each state means in practice</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {stateCards.map((state) => (
                  <div key={state.name} className={`rounded-2xl border p-5 ${state.tone}`}>
                    <div className="text-xs font-mono uppercase tracking-[0.24em]">{state.name}</div>
                    <p className="mt-3 text-sm leading-6 text-white/80">{state.description}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-8">
              <p className="text-sm font-mono uppercase tracking-[0.25em] text-cyan-300">Settlement Notes</p>
              <h2 className="mt-3 text-3xl font-display font-bold text-white">Important V2.21 rules</h2>
              <div className="mt-8 space-y-4">
                {[
                  'Reserve visibility is not hidden on-chain. Privacy in V2.21 comes from sealed bids and the reveal window.',
                  'The winner path must clear the challenge phase before final completion.',
                  'Seller payout and platform fee claim are separate steps; fee claim only unlocks after seller payout.',
                  'Ops Console reads shared lifecycle data, but the premium pages remain the main place where auctions are synced and acted upon.',
                ].map((note) => (
                  <div key={note} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-white/70">
                    {note}
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-8 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-mono uppercase tracking-[0.25em] text-cyan-300">Roles</p>
            <h2 className="mt-3 text-4xl font-display font-bold text-white">Who does what in the premium workflow</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {roleCards.map((card) => (
              <GlassCard key={card.title} hover className="p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/15 to-gold-500/15">
                  <card.icon className="h-6 w-6 text-cyan-300" />
                </div>
                <h3 className="mt-5 text-2xl font-display font-bold text-white">{card.title}</h3>
                <div className="mt-5 space-y-3">
                  {card.items.map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm leading-6 text-white/68">
                      <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-gold-400" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-8 pb-20">
        <div className="mx-auto max-w-5xl">
          <GlassCard glow className="overflow-hidden p-10 md:p-12">
            <div className="absolute inset-0 bg-gradient-to-r from-gold-500/10 via-transparent to-cyan-500/10" />
            <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-mono uppercase tracking-[0.25em] text-cyan-300">Ready to test the flow</p>
                <h2 className="mt-3 text-4xl font-display font-bold text-white">
                  Move from the explainer into the live V2.21 experience
                </h2>
                <p className="mt-4 text-white/65">
                  Browse the current premium auctions, create a new listing, or open Ops Console if you are reviewing admin-side lifecycle behavior.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <PremiumButton size="lg" onClick={() => navigate('/premium-auctions')}>
                  Browse Auctions
                </PremiumButton>
                <PremiumButton variant="secondary" size="lg" onClick={() => navigate('/ops')}>
                  Open Ops Console
                </PremiumButton>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}
