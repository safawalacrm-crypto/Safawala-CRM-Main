'use client';

import { useState, type SyntheticEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileDigit, KeyRound, Save, UserRound } from 'lucide-react';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

export type DocumentSeries =
  | 'sale_booking'
  | 'rental_booking'
  | 'sale_quote'
  | 'rental_quote';

export type DocumentNumberSetting = {
  series: DocumentSeries;
  prefix: string;
  next_number: number;
  number_padding: number;
  sequence_year: number;
};

const currentYear = new Date().getFullYear();
const seriesConfig: Array<{
  series: DocumentSeries;
  title: string;
  description: string;
  prefix: string;
}> = [
  {
    series: 'sale_booking',
    title: 'Sale booking invoices',
    description: 'Numbers for completed and active sale bookings',
    prefix: 'SW-S-',
  },
  {
    series: 'rental_booking',
    title: 'Rental booking invoices',
    description: 'Numbers for completed and active rental bookings',
    prefix: 'SW-R-',
  },
  {
    series: 'sale_quote',
    title: 'Sale quotations',
    description: 'Numbers used when a sale quote is created',
    prefix: 'SW-Q-S-',
  },
  {
    series: 'rental_quote',
    title: 'Rental quotations',
    description: 'Numbers used when a rental quote is created',
    prefix: 'SW-Q-R-',
  },
];

function normalizedPrefix(value: string) {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '-');
  return compact.endsWith('-') ? compact : `${compact}-`;
}

function initialRows(rows: DocumentNumberSetting[]) {
  return seriesConfig.map((config) => {
    const saved = rows.find((row) => row.series === config.series);
    return {
      series: config.series,
      prefix: saved?.prefix ?? config.prefix,
      next_number: saved?.next_number ?? 1,
      number_padding: saved?.number_padding ?? 4,
      sequence_year: saved?.sequence_year ?? currentYear,
    };
  });
}

function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

export function SettingsPanel({
  currentEmail,
  initialSettings,
  loadError,
}: {
  currentEmail: string;
  initialSettings: DocumentNumberSetting[];
  loadError: string;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(() => initialRows(initialSettings));
  const [accountBusy, setAccountBusy] = useState(false);
  const [numberBusy, setNumberBusy] = useState(false);
  const [error, setError] = useState(loadError);
  const [notice, setNotice] = useState('');

  function message(text: string) {
    setError('');
    setNotice(text);
  }

  async function changeLoginEmail(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accountBusy) return;
    const form = new FormData(event.currentTarget);
    const email = formText(form, 'email').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setError('Enter a valid login email address.');
      return;
    }
    if (email === currentEmail.toLowerCase()) {
      setError('Enter a different email address.');
      return;
    }

    setAccountBusy(true);
    setError('');
    setNotice('');
    const { error: updateError } = await createClient().auth.updateUser({ email });
    setAccountBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    message('Confirmation links were sent. The login email changes after confirmation.');
  }

  async function changePassword(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accountBusy) return;
    const form = new FormData(event.currentTarget);
    const password = formText(form, 'password');
    const confirmation = formText(form, 'password_confirmation');
    if (password.length < 8) {
      setError('The new password must contain at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The password confirmation does not match.');
      return;
    }

    setAccountBusy(true);
    setError('');
    setNotice('');
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setAccountBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    event.currentTarget.reset();
    message('Password changed successfully.');
  }

  async function saveDocumentNumbers() {
    if (numberBusy) return;
    const normalized = settings.map((setting) => ({
      ...setting,
      prefix: normalizedPrefix(setting.prefix),
      next_number: Number(setting.next_number),
      number_padding: Number(setting.number_padding),
      sequence_year: currentYear,
    }));
    if (
      normalized.some(
        (setting) =>
          !/^[A-Z0-9-]{2,24}-$/.test(setting.prefix) ||
          !Number.isInteger(setting.next_number) ||
          setting.next_number < 1 ||
          setting.next_number > 99999999 ||
          !Number.isInteger(setting.number_padding) ||
          setting.number_padding < 2 ||
          setting.number_padding > 8,
      )
    ) {
      setError('Use letters, numbers and hyphens for prefixes. Number range must be valid.');
      return;
    }

    setNumberBusy(true);
    setError('');
    setNotice('');
    const supabase = createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setError('Your session has expired. Please sign in again.');
      setNumberBusy(false);
      return;
    }
    const payload = normalized.map((setting) => ({
      owner_id: auth.user.id,
      ...setting,
    }));
    const result = await supabase
      .from('document_number_settings')
      .upsert(payload, { onConflict: 'owner_id,series' })
      .select('series,prefix,next_number,number_padding,sequence_year');
    setNumberBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setSettings(initialRows((result.data ?? []) as DocumentNumberSetting[]));
    message('Document numbering settings saved successfully.');
    router.refresh();
  }

  function updateSetting(
    series: DocumentSeries,
    field: 'prefix' | 'next_number' | 'number_padding',
    value: string,
  ) {
    setSettings((current) =>
      current.map((setting) =>
        setting.series === series
          ? {
              ...setting,
              [field]: field === 'prefix' ? value : Number(value),
            }
          : setting,
      ),
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <DashboardHeader
        title="Settings"
        subtitle="Manage account access and document numbering"
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Settings could not be updated</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <CheckCircle2 />
          <AlertTitle>Saved</AlertTitle>
          <AlertDescription className="text-emerald-700">{notice}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="border-border shadow-level-1 ring-0">
          <CardHeader className="border-b bg-[#fcfaf7]">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                <UserRound className="size-5" />
              </span>
              <div>
                <CardTitle>Login email</CardTitle>
                <CardDescription>Change the ID used to sign in</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={changeLoginEmail}>
              <label className="block text-sm font-medium" htmlFor="login-email">
                New login email
              </label>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={currentEmail}
                className="h-11"
                required
              />
              <Button type="submit" disabled={accountBusy}>
                Save login email
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border shadow-level-1 ring-0">
          <CardHeader className="border-b bg-[#fcfaf7]">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                <KeyRound className="size-5" />
              </span>
              <div>
                <CardTitle>Password</CardTitle>
                <CardDescription>Use at least 8 characters</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={changePassword}>
              <label className="space-y-1.5 text-sm font-medium" htmlFor="new-password">
                <span>New password</span>
                <Input
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  className="h-11"
                  minLength={8}
                  required
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium" htmlFor="confirm-password">
                <span>Confirm password</span>
                <Input
                  id="confirm-password"
                  name="password_confirmation"
                  type="password"
                  autoComplete="new-password"
                  className="h-11"
                  minLength={8}
                  required
                />
              </label>
              <Button type="submit" className="sm:col-span-2 sm:w-fit" disabled={accountBusy}>
                Change password
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border shadow-level-1 ring-0">
        <CardHeader className="border-b bg-[#fcfaf7]">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <FileDigit className="size-5" />
            </span>
            <div>
              <CardTitle>Document numbering</CardTitle>
              <CardDescription>
                Configure the prefix and next number for each independent series
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {seriesConfig.map((config) => {
              const setting = settings.find((row) => row.series === config.series)!;
              const prefix = normalizedPrefix(setting.prefix || config.prefix);
              const preview = `${prefix}${currentYear}-${String(setting.next_number || 1).padStart(setting.number_padding || 4, '0')}`;
              return (
                <div key={config.series} className="rounded-xl border bg-white p-4">
                  <div className="mb-4">
                    <h3 className="font-semibold">{config.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1.25fr_.8fr_.7fr]">
                    <label
                      className="space-y-1.5 text-sm font-medium"
                      htmlFor={`${config.series}-prefix`}
                    >
                      <span>Prefix</span>
                      <Input
                        id={`${config.series}-prefix`}
                        value={setting.prefix}
                        onChange={(event) => updateSetting(config.series, 'prefix', event.target.value)}
                        aria-label={`${config.title} prefix`}
                        className="h-10 uppercase"
                      />
                    </label>
                    <label
                      className="space-y-1.5 text-sm font-medium"
                      htmlFor={`${config.series}-next-number`}
                    >
                      <span>Next number</span>
                      <Input
                        id={`${config.series}-next-number`}
                        type="number"
                        min={1}
                        max={99999999}
                        value={setting.next_number}
                        onChange={(event) => updateSetting(config.series, 'next_number', event.target.value)}
                        aria-label={`${config.title} next number`}
                        className="h-10"
                      />
                    </label>
                    <label
                      className="space-y-1.5 text-sm font-medium"
                      htmlFor={`${config.series}-digits`}
                    >
                      <span>Digits</span>
                      <Input
                        id={`${config.series}-digits`}
                        type="number"
                        min={2}
                        max={8}
                        value={setting.number_padding}
                        onChange={(event) => updateSetting(config.series, 'number_padding', event.target.value)}
                        aria-label={`${config.title} digits`}
                        className="h-10"
                      />
                    </label>
                  </div>
                  <div className="mt-4 rounded-lg border border-[#e4d2b6] bg-[#fcfaf7] px-3 py-2.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-[#70481c]">{preview}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Existing invoices remain unchanged. New documents use the saved series.
            </p>
            <Button type="button" onClick={saveDocumentNumbers} disabled={numberBusy}>
              <Save />
              Save numbering settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
