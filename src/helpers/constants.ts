import { readFileSync } from 'fs';

export const CRON_BANK_LENGTH = 60000; // 1 minute
export const CRON_AUTH_LENGTH = 300000; // 5 minutes
export const CRON_SESSION_LENGTH = 60000; // 1 minute
export const CRON_MINT_LENGTH = 30000 // 30 seconds
export const CRON_REFUND_LENGTH = 30000; // 30 seconds
export const MAX_SESSION_LENGTH_SPO = 86400000; // 24 hours
export const MAX_SESSION_LENGTH_CLI = 86400000; // 24 hours
export const MAX_ACCESS_LENGTH = 1800000; // 30 minutes
export const PAYMENT_ADDRESS_THRESHOLD = 10;
export const WALLET_BALANCE_THRESHOLD = 1000 * 1000000;
export const SPO_HANDLE_ADA_COST = 250;
export const SPO_HANDLE_ADA_REFUND_FEE = 50;
export const HEADER_EMAIL_AUTH = 'x-email-authcode';
export const HEADER_EMAIL = 'x-email';
export const HEADER_HANDLE = 'x-handle';
export const HEADER_RECAPTCHA = 'x-recaptcha';
export const HEADER_TWITTER_ACCESS_TOKEN = 'x-twitter-token';
export const TWITTER_UNLOCK_HEADER = 'x-twitter-credentials';
export const HEADER_JWT_ACCESS_TOKEN = 'x-access-token';
export const HEADER_JWT_SESSION_TOKEN = 'x-session-token';
export const AUTH_CODE_TIMEOUT_MINUTES = 60;
export const MAX_SESSION_COUNT = 3;

export enum CreatedBySystem {
  UI = 'UI',
  CLI = 'CLI',
  SPO = 'SPO'
}

/**
 * a-z
 * 0-9
 * _
 * -
 * .
 */
export const ALLOWED_CHAR = new RegExp(/^[a-zA-Z0-9\-_.]{1,15}$/);

/**
 * Must match all:
 * - 2 characters or more
 */
export const BETA_PHASE_MATCH = new RegExp(/.{2,}/g);

/**
 * Environment specific.
 */
export const getPrivatePath = (): string =>
  process.env.POLICY_DATA_DIR as string;

export const getWalletEndpoint = (): string =>
  process.env.WALLET_ENDPOINT as string;

export const getGraphqlEndpoint = (): string =>
  process.env.GRAPHQL_ENDPOINT as string;

export const getMintingWalletId = (): string => {
  const walletId = readFileSync(`${getPrivatePath()}/walletid.txt`, {
    encoding: 'utf-8'
  });

  return walletId.trim();
}

export const getMintingWalletSeedPhrase = (): string => {
  const seed = readFileSync(`${getPrivatePath()}/seedphrase.txt`, {
    encoding: 'utf-8'
  });

  return JSON.parse(seed.trim());
}

export const getPaymentWalletId = (): string => {
  const walletId = readFileSync(`${getPrivatePath()}/paymentwalletid.txt`, {
    encoding: 'utf-8'
  });

  return walletId.trim();
}

export const getPaymentWalletSeedPhrase = (): string => {
  const seed = readFileSync(`${getPrivatePath()}/paymentseedphrase.txt`, {
    encoding: 'utf-8'
  });

  return JSON.parse(seed.trim());
}

export const getPolicyId = (): string => {
  const policyId = readFileSync(`${getPrivatePath()}/policyid.txt`, {
    encoding: 'utf-8'
  });

  return policyId.trim();
}

export const getPolicyPrivateKey = (): string => {
  const file = readFileSync(`${getPrivatePath()}/private.txt`, {
    encoding: 'utf-8'
  });

  return file.trim();
}

export const isProduction = (): boolean => {
  // currently NODE_ENV is not set to 'master' in buddy
  return process.env.NODE_ENV?.trim() === 'production' || process.env.NODE_ENV?.trim() === 'master';
}

export const isTesting = (): boolean => {
  return process.env.NODE_ENV?.trim() === 'test';
}
export const isEmulating = (): boolean => {
  return process.env.EMULATE_FIRESTORE?.trim() === 'true';
}

export const isLocal = (): boolean => {
  return process.env.NODE_ENV?.trim() === 'local';
}

export const getAdaHandleDomain = (): string => {
  if (isLocal() || isTesting()) return 'http://localhost:8888';
  if (isProduction()) return 'https://adahandle.com';
  return 'https://testnet.adahandle.com';
}