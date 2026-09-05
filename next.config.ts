import type { NextConfig } from 'next';

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  agentRules: false,
  images: supabaseHostname
    ? { remotePatterns: [{ protocol: 'https', hostname: supabaseHostname }] }
    : undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
