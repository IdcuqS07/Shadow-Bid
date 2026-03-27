import React from 'react';
import { cn } from '@/lib/utils';

const variants = {
  primary: `
    bg-gradient-to-r from-gold-500 to-gold-600
    text-void-900
    shadow-glow-gold
    hover:shadow-[0_8px_24px_rgba(212,175,55,0.4)]
    hover:-translate-y-0.5
  `,
  secondary: `
    bg-void-800
    text-white
    border border-white/20
    hover:border-gold-500/50
    hover:bg-void-700
  `,
  ghost: `
    bg-transparent
    text-white
    border border-white/10
    hover:bg-white/5
    hover:border-white/20
  `,
  cyan: `
    bg-gradient-to-r from-cyan-500 to-cyan-600
    text-void-900
    shadow-glow-cyan
    hover:shadow-[0_8px_24px_rgba(0,229,255,0.4)]
    hover:-translate-y-0.5
  `,
};

const sizes = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
  xl: 'px-10 py-5 text-lg',
};

export default function PremiumButton({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...props
}) {
  return (
    <button
      className={cn(
        // Base styles
        "relative",
        "font-semibold",
        "uppercase",
        "tracking-wider",
        "rounded-xl",
        "transition-all duration-300",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none",
        "z-50",
        
        // Variant
        variants[variant],
        
        // Size
        sizes[size],
        
        className
      )}
      disabled={disabled}
      style={{ pointerEvents: disabled ? 'none' : 'auto', position: 'relative', zIndex: 50 }}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      
      {/* Shine effect */}
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>
    </button>
  );
}
