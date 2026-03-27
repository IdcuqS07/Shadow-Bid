import React from 'react';
import { cn } from '@/lib/utils';

export default function GlassCard({ 
  children, 
  className,
  hover = false,
  glow = false,
  ...props 
}) {
  return (
    <div
      className={cn(
        // Base glass effect
        "relative",
        "bg-gradient-to-br from-white/5 to-white/0",
        "backdrop-blur-xl",
        "border border-white/10",
        "rounded-2xl",
        "shadow-glass",
        
        // Hover effect
        hover && "transition-all duration-300 hover:-translate-y-1 hover:border-gold-500/50 hover:shadow-glow-gold",
        
        // Glow effect
        glow && "shadow-glow-cyan",
        
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassCardHeader({ children, className }) {
  return (
    <div className={cn("p-6 border-b border-white/5", className)}>
      {children}
    </div>
  );
}

export function GlassCardContent({ children, className }) {
  return (
    <div className={cn("p-6", className)}>
      {children}
    </div>
  );
}

export function GlassCardFooter({ children, className }) {
  return (
    <div className={cn("p-6 border-t border-white/5", className)}>
      {children}
    </div>
  );
}
