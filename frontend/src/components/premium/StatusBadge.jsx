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
  'awaiting-close': {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    dot: 'bg-amber-300',
  },
  'reveal-phase': {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    dot: 'bg-blue-300',
  },
  'awaiting-settlement': {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    dot: 'bg-amber-300',
  },
  'dispute-window': {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    text: 'text-warning',
    dot: 'bg-warning',
  },
};

const sizeStyles = {
  md: {
    container: 'gap-2 px-3 py-1.5 text-xs tracking-wider',
    dot: 'h-1.5 w-1.5',
  },
  sm: {
    container: 'gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.2em]',
    dot: 'h-1.5 w-1.5',
  },
};

export default function StatusBadge({ status = 'open', size = 'md', className, ...props }) {
  const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : 'open';
  const styles = statusStyles[normalizedStatus] || statusStyles.active;
  const label = typeof status === 'string' ? status.replace(/-/g, ' ') : 'open';
  const sizing = sizeStyles[size] || sizeStyles.md;
  
  return (
    <span
      className={cn(
        "inline-flex items-center",
        styles.bg,
        "border",
        styles.border,
        "rounded-full",
        styles.text,
        "font-mono uppercase",
        sizing.container,
        className
      )}
      {...props}
    >
      <span className={cn("rounded-full animate-pulse", sizing.dot, styles.dot)} />
      {label}
    </span>
  );
}
