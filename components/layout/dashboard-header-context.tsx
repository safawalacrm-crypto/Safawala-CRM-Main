'use client';

import { createContext, type ReactNode } from 'react';

export type PageHeader = { title: string; subtitle: string; actions?: ReactNode; backHref?: string | null } | null;
export const DashboardHeaderContext = createContext<((header: PageHeader) => void) | null>(null);
