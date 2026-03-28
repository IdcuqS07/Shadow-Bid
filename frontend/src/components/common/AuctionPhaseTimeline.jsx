import { Check } from 'lucide-react';

const PHASES = [
  { key: 'created',    label: 'Created' },
  { key: 'active',     label: 'Sealed Bid' },
  { key: 'closed', label: 'Reveal' },
  { key: 'challenge', label: 'Dispute' },
  { key: 'settled',    label: 'Settled' },
];

const PHASE_ORDER = PHASES.map((p) => p.key);

function getPhaseIndex(status) {
  const normalizedStatus = ({
    open: 'active',
    reveal_open: 'closed',
    pending_settlement: 'challenge',
    cancelled: 'challenge',
    disputed: 'challenge',
  })[status] || status;

  const idx = PHASE_ORDER.indexOf(normalizedStatus);
  return idx === -1 ? 0 : idx;
}

export function AuctionPhaseTimeline({ status }) {
  const currentIdx = getPhaseIndex(status);

  return (
    <div className="w-full">
      <div className="flex items-center">
        {PHASES.map((phase, idx) => {
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;

          return (
            <div key={phase.key} className="flex flex-1 items-center">
              {/* Node */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all
                    ${isDone ? 'border-indigo-500 bg-indigo-500 text-white'
                    : isActive ? 'border-indigo-400 bg-indigo-900/60 text-indigo-300 ring-2 ring-indigo-500/30'
                    : 'border-slate-600 bg-slate-800 text-slate-500'}`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <span
                  className={`text-center text-[10px] font-medium leading-tight
                    ${isActive ? 'text-indigo-300' : isDone ? 'text-slate-400' : 'text-slate-600'}`}
                  style={{ maxWidth: 56 }}
                >
                  {phase.label}
                </span>
              </div>

              {/* Connector */}
              {idx < PHASES.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 rounded transition-all
                    ${idx < currentIdx ? 'bg-indigo-500' : 'bg-slate-700'}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
