import React from 'react';
import { cn } from '@/lib/utils';

export default function PremiumInput({
  label,
  suffix,
  prefix,
  error,
  className,
  ...props
}) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-mono text-white/60 uppercase tracking-wider">
          {label}
        </label>
      )}
      
      <div className="relative">
        {prefix && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-mono text-sm">
            {prefix}
          </div>
        )}
        
        <input
          className={cn(
            "w-full",
            "px-6 py-4",
            "bg-void-800 !bg-void-800",
            "border border-white/10",
            "rounded-xl",
            "text-white !text-white",
            "placeholder:text-white/30",
            "focus:border-gold-500/50",
            "focus:outline-none",
            "focus:ring-2 focus:ring-gold-500/20",
            "focus:bg-void-800",
            "transition-all duration-300",
            "autofill:bg-void-800",
            error && "border-error focus:border-error focus:ring-error/20",
            prefix && "pl-12",
            suffix && "pr-20",
            className
          )}
          style={{
            backgroundColor: '#12141A',
            color: '#ffffff',
            backgroundImage: 'none',
          }}
          {...props}
        />
        
        {suffix && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 font-mono text-sm">
            {suffix}
          </div>
        )}
      </div>
      
      {error && (
        <p className="text-error text-xs font-mono">{error}</p>
      )}
    </div>
  );
}
