import { ShieldCheck, ShieldOff, Lock } from 'lucide-react';

const states = {
  protected: {
    icon: Lock,
    label: 'ZK Protected',
    className: 'bg-violet-900/40 border border-violet-500/30 text-violet-300',
  },
  revealed: {
    icon: ShieldOff,
    label: 'Revealed',
    className: 'bg-sky-900/40 border border-sky-500/30 text-sky-300',
  },
  verified: {
    icon: ShieldCheck,
    label: 'ZK Verified',
    className: 'bg-emerald-900/40 border border-emerald-500/30 text-emerald-300',
  },
};

export function ZkPrivacyIndicator({ state = 'protected', showLabel = true }) {
  const config = states[state] || states.protected;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}>
      <Icon className="h-3 w-3" />
      {showLabel && config.label}
    </span>
  );
}
