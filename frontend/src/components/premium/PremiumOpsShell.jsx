import { Outlet } from 'react-router-dom';
import PremiumNav from '@/components/premium/PremiumNav';

export default function PremiumOpsShell() {
  return (
    <div className="min-h-screen overflow-hidden bg-void-900 text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            background: `
              radial-gradient(circle at 18% 18%, rgba(0, 229, 255, 0.12) 0%, transparent 34%),
              radial-gradient(circle at 82% 22%, rgba(212, 175, 55, 0.12) 0%, transparent 30%),
              radial-gradient(circle at 50% 100%, rgba(55, 85, 160, 0.18) 0%, transparent 42%)
            `,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <PremiumNav />

      <main className="relative z-10 mx-auto max-w-[1400px] px-6 py-8 md:px-10 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
