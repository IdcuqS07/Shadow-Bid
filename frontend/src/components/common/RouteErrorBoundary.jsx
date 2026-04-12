import React from 'react';
import PremiumButton from '@/components/premium/PremiumButton';

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RouteErrorBoundary] Route render failed:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ error: null });

    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    const message = error instanceof Error ? error.message : 'Unknown render error';

    return (
      <div className="min-h-screen bg-void-900 px-6 py-12 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-500/25 bg-white/5 p-8">
          <div className="text-xs font-mono uppercase tracking-[0.24em] text-red-300">Route Error</div>
          <h1 className="mt-4 text-3xl font-display font-bold">This page hit a render error</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            ShadowBid caught a runtime error before the page could render completely. Reloading usually fixes stale browser data issues.
          </p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-xs text-red-200">
            {message}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <PremiumButton type="button" onClick={this.handleReset}>
              Retry Page
            </PremiumButton>
            <PremiumButton
              type="button"
              variant="ghost"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.assign('/premium-auctions');
                }
              }}
            >
              Back to Auctions
            </PremiumButton>
          </div>
        </div>
      </div>
    );
  }
}
