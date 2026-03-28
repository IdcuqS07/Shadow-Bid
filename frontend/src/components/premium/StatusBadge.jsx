import React from 'react';
import { cn } from '@/lib/utils';

const statusStyles = {
  open: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
  },
  active: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
  },
  closed: {
    bg: 'bg-white/5',
    border: 'border-white/20',
    text: 'text-white/60',
    dot: 'bg-white/60',
  },
  challenge: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    text: 'text-warning',
    dot: 'bg-warning',
  },
  settled: {
    bg: 'bg-success/10',
    border: 'border-success/30',
    text: 'text-success',
    dot: 'bg-success',
  },
  cancelled: {
    bg: 'bg-error/10',
    border: 'border-error/30',
    text: 'text-error',
    dot: 'bg-error',
  },
  disputed: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-300',
    dot: 'bg-red-300',
  },
  failed: {
    bg: 'bg-error/10',
    border: 'border-error/30',
    text: 'text-error',
    dot: 'bg-error',
  },
  revealing: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    text: 'text-warning',
    dot: 'bg-warning',
  },
};

export default function StatusBadge({ status = 'open', className }) {
  const styles = statusStyles[status.toLowerCase()] || statusStyles.active;
  const label = status.replace(/-/g, ' ');
  
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        "px-3 py-1.5",
        styles.bg,
        "border",
        styles.border,
        "rounded-full",
        styles.text,
        "text-xs font-mono",
        "uppercase tracking-wider",
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", styles.dot)} />
      {label}
    </span>
  );
}
