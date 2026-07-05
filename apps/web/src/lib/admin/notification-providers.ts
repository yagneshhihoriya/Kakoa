/**
 * Notification provider status (HANDOFF-Notifications §6/§7) — derived from ENV
 * PRESENCE only; NO secret values are ever returned. Tells the admin whether
 * real delivery is configured (Resend / MSG91) or simulated (Fake).
 *
 * SERVER-ONLY: reads server env.
 */
import { parseServerEnv } from '@kakoa/config';

export interface ProviderStatus {
  email: { provider: 'resend' | 'fake'; live: boolean };
  sms: { provider: 'msg91' | 'fake'; live: boolean; note: string };
}

export function getProviderStatus(): ProviderStatus {
  const env = parseServerEnv();
  const emailLive = env.RESEND_API_KEY !== undefined;
  const smsLive = env.MSG91_AUTH_KEY !== undefined && env.OTP_TEST_MODE !== '1';
  return {
    email: { provider: emailLive ? 'resend' : 'fake', live: emailLive },
    sms: {
      provider: smsLive ? 'msg91' : 'fake',
      live: smsLive,
      note: 'Transactional SMS in India requires DLT registration before real delivery.',
    },
  };
}
