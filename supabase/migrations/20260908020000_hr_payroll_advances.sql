-- Payroll upgrade: advances and automatic net salary.
alter table public.hr_payroll
  add column if not exists advances numeric(12,2) not null default 0 check (advances >= 0);

alter table public.hr_payroll
  add column if not exists net_salary numeric(12,2)
  generated always as (base_salary + allowances - deductions - advances) stored;

notify pgrst, 'reload schema';
