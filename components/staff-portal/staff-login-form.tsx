'use client';

import { useActionState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandMark } from '@/components/brand-mark';
import { staffLogin, type StaffLoginState } from '@/app/staff-portal/login/actions';

const initialState: StaffLoginState = { error: '' };

export function StaffLoginForm() {
  const [state, formAction, pending] = useActionState(staffLogin, initialState);

  return (
    <section className="w-full max-w-[420px] rounded-xl border bg-card p-8 shadow-level-2">
      <BrandMark className="mx-auto" />
      <div className="mt-6 text-center">
        <span className="mx-auto mb-4 block h-1 w-12 rounded-full bg-primary" aria-hidden="true" />
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">Staff Portal</h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          Sign in with the login ID your admin gave you
        </p>
      </div>
      <form action={formAction} className="mt-8 space-y-5" noValidate>
        {state?.error ? (
          <Alert variant="destructive" className="px-3 py-3" aria-live="polite">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="loginId" className="block text-sm font-medium">
            Login ID
          </label>
          <Input
            id="loginId"
            name="loginId"
            autoComplete="username"
            placeholder="e.g. warehouse1"
            required
            className="h-11 rounded-md px-3"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            className="h-11 rounded-md px-3"
          />
        </div>

        <Button type="submit" disabled={pending} className="h-11 w-full rounded-md">
          {pending ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" /> Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>
      </form>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Access is granted by your admin from Manage Access
      </p>
    </section>
  );
}
