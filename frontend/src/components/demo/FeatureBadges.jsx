import { Shield, Eye, Zap } from 'lucide-react';

export function FeatureBadges() {
  const features = [
    {
      icon: Shield,
      label: 'Commit-Reveal',
      description: 'Commitment first, reveal later'
    },
    {
      icon: Zap,
      label: 'O(1) Settlement',
      description: 'Constant time winner'
    },
    {
      icon: Eye,
      label: 'ZK-Backed',
      description: 'Aleo execution proofs'
    }
  ];

  return (
    <div className="flex flex-wrap gap-6 justify-center md:justify-start">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <div key={feature.label} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Icon className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{feature.label}</p>
              <p className="text-xs text-slate-400">{feature.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
