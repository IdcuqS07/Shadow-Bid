# ShadowBid Premium Design System
## Luxury Fintech × Zero-Knowledge × Dark Glass Aesthetic

---

## 🎨 DESIGN PHILOSOPHY

**Core Concept**: "Invisible Wealth Terminal"
- Bloomberg Terminal meets luxury crypto vault
- Private, elite, mysterious
- Data-dense but elegant
- Trust through sophistication

**Mood Board References**:
- Bloomberg Terminal (data density)
- Stripe Dashboard (premium simplicity)
- Ledger Live (crypto trust)
- Rolls-Royce Configurator (luxury)
- Cyberpunk 2077 UI (futuristic)

---

## 🎭 VISUAL IDENTITY

### Brand Essence
```
SHADOWBID = Privacy × Precision × Power

Adjectives:
- Sophisticated (not flashy)
- Mysterious (not dark)
- Precise (not cluttered)
- Elite (not exclusive)
- Futuristic (not sci-fi)
```

---

## 🎨 COLOR SYSTEM

### Base Palette
```css
/* Primary Dark Base - NOT pure black */
--void-900: #0A0B0F;        /* Deep space */
--void-800: #12141A;        /* Card background */
--void-700: #1A1D26;        /* Elevated surface */
--void-600: #252933;        /* Hover state */

/* Metallic Accents */
--gold-500: #D4AF37;        /* Primary gold */
--gold-400: #E8C547;        /* Hover gold */
--gold-600: #B8941F;        /* Pressed gold */

--cyan-500: #00E5FF;        /* Data highlight */
--cyan-400: #33EBFF;        /* Glow */
--cyan-600: #00B8CC;        /* Muted */

--blue-500: #0066FF;        /* Trust blue */
--blue-400: #3385FF;        /* Interactive */
--blue-600: #0052CC;        /* Pressed */

/* Glass & Overlays */
--glass-white: rgba(255, 255, 255, 0.05);
--glass-border: rgba(255, 255, 255, 0.1);
--glass-glow: rgba(0, 229, 255, 0.15);

/* Semantic Colors */
--success: #00FF88;         /* Bright green */
--warning: #FFB800;         /* Amber */
--error: #FF3366;           /* Vibrant red */
--info: #00E5FF;            /* Cyan */

/* Text Hierarchy */
--text-primary: #FFFFFF;
--text-secondary: rgba(255, 255, 255, 0.7);
--text-tertiary: rgba(255, 255, 255, 0.4);
--text-disabled: rgba(255, 255, 255, 0.2);
```

### Gradient System
```css
/* Hero Gradients */
--gradient-hero: radial-gradient(
  ellipse at top,
  rgba(0, 102, 255, 0.15) 0%,
  rgba(10, 11, 15, 0) 50%
);

--gradient-mesh: 
  radial-gradient(at 20% 30%, rgba(212, 175, 55, 0.1) 0%, transparent 50%),
  radial-gradient(at 80% 70%, rgba(0, 229, 255, 0.1) 0%, transparent 50%),
  radial-gradient(at 50% 50%, rgba(0, 102, 255, 0.05) 0%, transparent 50%);

/* Card Gradients */
--gradient-glass: linear-gradient(
  135deg,
  rgba(255, 255, 255, 0.08) 0%,
  rgba(255, 255, 255, 0.02) 100%
);

/* Glow Effects */
--glow-gold: 0 0 40px rgba(212, 175, 55, 0.3);
--glow-cyan: 0 0 40px rgba(0, 229, 255, 0.3);
--glow-blue: 0 0 40px rgba(0, 102, 255, 0.3);
```

---

## ✍️ TYPOGRAPHY

### Font Stack
```css
/* Display - Sharp, Modern */
--font-display: 'Space Grotesk', 'SF Pro Display', system-ui, sans-serif;

/* Body - Clean, Readable */
--font-body: 'Inter Variable', -apple-system, BlinkMacSystemFont, sans-serif;

/* Mono - Data, Code */
--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;

/* Accent - Luxury Touch */
--font-accent: 'Playfair Display', 'Georgia', serif;
```

### Type Scale
```css
/* Hero / Display */
--text-hero: 72px;          /* Landing hero */
--text-display: 48px;       /* Page titles */
--text-headline: 36px;      /* Section headers */

/* Body */
--text-title: 24px;         /* Card titles */
--text-large: 18px;         /* Emphasized text */
--text-body: 16px;          /* Default */
--text-small: 14px;         /* Secondary */
--text-micro: 12px;         /* Labels */
--text-nano: 10px;          /* Metadata */

/* Line Heights */
--leading-tight: 1.2;
--leading-normal: 1.5;
--leading-relaxed: 1.75;

/* Letter Spacing */
--tracking-tight: -0.02em;
--tracking-normal: 0;
--tracking-wide: 0.05em;
--tracking-wider: 0.1em;
```

---

## 📐 SPACING SYSTEM

### Scale (8px base)
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
--space-32: 128px;
```

### Layout Grid
```css
--container-max: 1440px;
--container-padding: 80px;
--grid-gap: 24px;
--section-gap: 120px;
```

---

## 🎭 COMPONENT ANATOMY

### Glass Card
```css
.glass-card {
  background: var(--gradient-glass);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}
```

### Floating Panel
```css
.floating-panel {
  background: var(--void-800);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.6),
    0 0 1px rgba(255, 255, 255, 0.1);
  transform: translateZ(0);
}
```

### Premium Button
```css
.btn-primary {
  background: linear-gradient(135deg, var(--gold-500), var(--gold-600));
  color: var(--void-900);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-size: 14px;
  padding: 16px 32px;
  border-radius: 12px;
  border: none;
  box-shadow: 
    0 4px 16px rgba(212, 175, 55, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 8px 24px rgba(212, 175, 55, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
```

---

## 🎬 ANIMATION SYSTEM

### Timing Functions
```css
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--ease-elastic: cubic-bezier(0.68, -0.6, 0.32, 1.6);
```

### Durations
```css
--duration-fast: 150ms;
--duration-normal: 300ms;
--duration-slow: 500ms;
--duration-slower: 800ms;
```

### Key Animations
```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes glowPulse {
  0%, 100% {
    box-shadow: 0 0 20px rgba(0, 229, 255, 0.3);
  }
  50% {
    box-shadow: 0 0 40px rgba(0, 229, 255, 0.6);
  }
}

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}
```

---

## 🎨 PAGE LAYOUTS

### 1. Landing / Hero
```
┌─────────────────────────────────────────────────┐
│  [Logo]                    [Connect Wallet]     │
├─────────────────────────────────────────────────┤
│                                                 │
│         PRIVATE SEALED-BID                      │
│         AUCTIONS                                │
│         ON ALEO                                 │
│                                                 │
│         [Zero-Knowledge Proof]                  │
│         [Maximum Privacy]                       │
│         [Instant Settlement]                    │
│                                                 │
│         [Enter App →]                           │
│                                                 │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│    │ Feature  │  │ Feature  │  │ Feature  │   │
│    │   Card   │  │   Card   │  │   Card   │   │
│    └──────────┘  └──────────┘  └──────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 2. Auction List (Asymmetric Grid)
```
┌─────────────────────────────────────────────────┐
│  [Filters]              [Search]    [Create]    │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────┐  ┌──────────┐            │
│  │                  │  │          │            │
│  │  Featured        │  │  Active  │            │
│  │  Auction         │  │  #12345  │            │
│  │  (Large)         │  └──────────┘            │
│  │                  │  ┌──────────┐            │
│  └──────────────────┘  │  Active  │            │
│                        │  #12346  │            │
│  ┌──────────┐         └──────────┘            │
│  │  Active  │                                  │
│  │  #12347  │         ┌──────────────────┐    │
│  └──────────┘         │                  │    │
│                       │  Ending Soon     │    │
│  ┌──────────┐         │  (Wide)          │    │
│  │  Active  │         │                  │    │
│  │  #12348  │         └──────────────────┘    │
│  └──────────┘                                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 3. Auction Detail (Layered)
```
┌─────────────────────────────────────────────────┐
│  ← Back                                         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌────────────────────────────────────────┐    │
│  │                                        │    │
│  │  AUCTION #123456                       │    │
│  │  Status: ACTIVE                        │    │
│  │                                        │    │
│  │  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │ Min Bid      │  │ Ends In      │   │    │
│  │  │ 1.5 ALEO     │  │ 2h 34m       │   │    │
│  │  └──────────────┘  └──────────────┘   │    │
│  │                                        │    │
│  └────────────────────────────────────────┘    │
│                                                 │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │                  │  │                  │    │
│  │  Place Bid       │  │  Auction Info    │    │
│  │  (Floating)      │  │  (Glass Panel)   │    │
│  │                  │  │                  │    │
│  └──────────────────┘  └──────────────────┘    │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🎯 UNIQUE DESIGN ELEMENTS

### 1. Noise Texture Overlay
```css
.noise-overlay {
  position: fixed;
  inset: 0;
  background-image: url('data:image/svg+xml,...');
  opacity: 0.03;
  pointer-events: none;
  mix-blend-mode: overlay;
}
```

### 2. Animated Grid Background
```css
.grid-background {
  background-image: 
    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size: 40px 40px;
  animation: gridMove 20s linear infinite;
}
```

### 3. Glow Orbs
```css
.glow-orb {
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.15;
  pointer-events: none;
}
```

### 4. Data Visualization Style
```css
.data-viz {
  font-family: var(--font-mono);
  font-size: 14px;
  letter-spacing: 0.05em;
  color: var(--cyan-500);
  text-shadow: 0 0 10px rgba(0, 229, 255, 0.5);
}
```

---

## 🎨 COMPONENT LIBRARY

### Status Badge
```jsx
<span className="
  inline-flex items-center gap-2
  px-3 py-1.5
  bg-cyan-500/10 
  border border-cyan-500/30
  rounded-full
  text-cyan-400 text-xs font-mono
  uppercase tracking-wider
">
  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
  Active
</span>
```

### Stat Card
```jsx
<div className="
  p-6
  bg-gradient-to-br from-white/5 to-white/0
  backdrop-blur-xl
  border border-white/10
  rounded-2xl
  hover:border-gold-500/50
  transition-all duration-300
">
  <div className="text-sm text-white/40 uppercase tracking-wider mb-2">
    Total Volume
  </div>
  <div className="text-3xl font-display font-bold text-white mb-1">
    1,234.56
  </div>
  <div className="text-sm font-mono text-cyan-400">
    ALEO
  </div>
</div>
```

### Input Field
```jsx
<div className="relative">
  <input 
    className="
      w-full
      px-6 py-4
      bg-void-800
      border border-white/10
      rounded-xl
      text-white
      font-mono
      placeholder:text-white/30
      focus:border-gold-500/50
      focus:outline-none
      focus:ring-2 focus:ring-gold-500/20
      transition-all duration-300
    "
    placeholder="Enter bid amount..."
  />
  <div className="absolute right-4 top-1/2 -translate-y-1/2">
    <span className="text-white/40 text-sm font-mono">ALEO</span>
  </div>
</div>
```

---

## 🎬 MICRO-INTERACTIONS

### Hover States
```css
/* Card Hover */
.card:hover {
  transform: translateY(-4px);
  border-color: var(--gold-500);
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.6),
    0 0 40px rgba(212, 175, 55, 0.2);
}

/* Button Hover */
.button:hover {
  transform: scale(1.02);
  box-shadow: 0 0 30px rgba(212, 175, 55, 0.4);
}

/* Link Hover */
.link:hover {
  color: var(--gold-400);
  text-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
}
```

### Loading States
```jsx
<div className="
  relative overflow-hidden
  bg-white/5
  rounded-lg
  h-20
">
  <div className="
    absolute inset-0
    bg-gradient-to-r from-transparent via-white/10 to-transparent
    animate-shimmer
  " />
</div>
```

---

## 🎯 ACCESSIBILITY

### Focus States
```css
*:focus-visible {
  outline: 2px solid var(--gold-500);
  outline-offset: 4px;
  border-radius: 4px;
}
```

### Color Contrast
- All text meets WCAG AA standards
- Interactive elements have 4.5:1 contrast minimum
- Status indicators use both color AND icon

---

## 📱 RESPONSIVE BREAKPOINTS

```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

---

## 🎨 DESIGN TOKENS (Tailwind Config)

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        void: {
          900: '#0A0B0F',
          800: '#12141A',
          700: '#1A1D26',
          600: '#252933',
        },
        gold: {
          400: '#E8C547',
          500: '#D4AF37',
          600: '#B8941F',
        },
        cyan: {
          400: '#33EBFF',
          500: '#00E5FF',
          600: '#00B8CC',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter Variable', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
    },
  },
}
```

---

## 🎯 IMPLEMENTATION PRIORITY

### Phase 1: Core Components
1. Design tokens setup
2. Glass card component
3. Button system
4. Input fields
5. Typography system

### Phase 2: Layout
1. Navigation
2. Grid system
3. Container components
4. Spacing utilities

### Phase 3: Pages
1. Landing hero
2. Auction list
3. Auction detail
4. Bid submission
5. Settlement

### Phase 4: Polish
1. Animations
2. Micro-interactions
3. Loading states
4. Error states
5. Empty states

---

**This is a $10k+ design system. Let's implement it.** 🚀
