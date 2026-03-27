import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PremiumSelect({
  label,
  value,
  onChange,
  options,
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
        <select
          value={value}
          onChange={onChange}
          className={cn(
            "w-full",
            "px-6 py-4",
            "bg-void-800 !bg-void-800",
            "border border-white/10",
            "rounded-xl",
            "text-white !text-white",
            "font-mono",
            "appearance-none",
            "cursor-pointer",
            "focus:border-gold-500/50",
            "focus:outline-none",
            "focus:ring-2 focus:ring-gold-500/20",
            "focus:bg-void-800",
            "transition-all duration-300",
            "pr-12",
            error && "border-error focus:border-error focus:ring-error/20",
            className
          )}
          style={{
            backgroundColor: '#12141A',
            color: '#ffffff',
            backgroundImage: 'none',
          }}
          {...props}
        >
          {options.map((option) => (
            <option 
              key={option.value} 
              value={option.value}
              disabled={option.disabled}
              style={{
                backgroundColor: '#12141A',
                color: option.disabled ? 'rgba(255, 255, 255, 0.4)' : '#ffffff',
              }}
            >
              {option.label}
            </option>
          ))}
        </select>
        
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown className="w-5 h-5 text-white/40" />
        </div>
      </div>
      
      {error && (
        <p className="text-error text-xs font-mono">{error}</p>
      )}
    </div>
  );
}
