import { redirect } from 'next/navigation';
import Image from 'next/image';
import { BrandMark } from '@/components/brand-mark';
import { LoginForm } from '@/components/auth/login-form';
import { hasSupabaseEnv } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const configured = hasSupabaseEnv();
  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect('/dashboard');
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
      <section className="grid w-full max-w-[1040px] overflow-hidden rounded-xl border bg-background shadow-level-2 md:grid-cols-[0.92fr_1.08fr]" aria-labelledby="login-title">
        <div className="relative min-h-52 overflow-hidden bg-primary p-6 text-white sm:p-8 md:m-4 md:min-h-[580px] md:rounded-lg md:p-10">
          <div aria-hidden="true" className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <BrandMark inverse className="relative z-10" />
          <div className="relative z-10 mt-12 max-w-sm md:mt-28">
            <div aria-hidden="true" className="mb-6 hidden h-28 w-40 overflow-hidden md:block">
              <Image src="/safawala-crown-light.png" alt="" width={320} height={112} className="h-28 w-auto max-w-none object-contain object-left opacity-95" />
            </div>
            <h2 className="max-w-[390px] text-[28px] font-semibold leading-[1.25] tracking-[-0.035em] sm:text-[34px] md:text-[40px]">
              Every celebration,<br className="hidden md:block" /> perfectly organized.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">Manage your Safawala relationships, contracts, and work from one quiet, secure place.</p>
          </div>
          <p className="absolute bottom-8 left-10 z-10 hidden text-xs text-white/50 md:block">Built for the Safawala team</p>
        </div>

        <div className="flex items-center px-6 py-10 sm:px-12 md:px-14 lg:px-16">
          <div className="mx-auto w-full max-w-[380px]">
            <div>
              <span className="mb-6 block h-1 w-12 rounded-full bg-primary" aria-hidden="true" />
              <h1 id="login-title" className="text-[28px] font-semibold leading-9 tracking-[-0.03em]">Welcome back</h1>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">Sign in to your Safawala CRM account</p>
            </div>
            <div className="my-7 h-px bg-border" />
            <LoginForm configured={configured} />
            <p className="mt-8 text-center text-xs text-muted-foreground">Securely powered by Supabase Authentication</p>
          </div>
        </div>
      </section>
    </main>
  );
}
