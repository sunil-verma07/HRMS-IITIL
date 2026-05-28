import type { ReactNode } from 'react';

type AuthLayoutProps = {
  children: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="grid min-h-screen overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden place-items-center border-r border-white/8 p-10 lg:grid">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.18),transparent_28rem),radial-gradient(circle_at_70%_70%,rgba(139,92,246,0.18),transparent_26rem)]" />
        <div className="glass-panel gradient-border relative max-w-xl animate-in fade-in slide-in-from-bottom-3 rounded-3xl p-8 duration-500">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-violet-400 font-black text-slate-950">IT</div>
            <div>
              <p className="text-xl font-semibold">IITIL Portal</p>
              <p className="text-sm text-muted-foreground">HRMS + ATS command center</p>
            </div>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">Enterprise operations, hiring, and workforce intelligence in one secure portal.</h1>
          <div className="mt-8 grid gap-3 text-sm text-muted-foreground">
            {['Permission-aware workflows', 'Live workforce analytics', 'Secure session architecture'].map((item) => (
              <div key={item} className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="grid place-items-center p-6">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
