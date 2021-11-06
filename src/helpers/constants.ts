import { readFileSync } from 'fs';

export const CRON_BANK_LENGTH = 60000; // 1 minute
export const CRON_AUTH_LENGTH = 300000; // 5 minutes
export const CRON_SESSION_LENGTH = 60000; // 1 minute
export const CRON_MINT_LENGTH = 30000 // 30 seconds
export const CRON_REFUND_LENGTH = 30000; // 30 seconds
export const MAX_SESSION_LENGTH = 600000; // 10 minutes
export const MAX_ACCESS_LENGTH = 1800000; // 30 minutes
export const AUTH_CODE_EXPIRE = 600000; // 10 minutes
export const PAYMENT_ADDRESS_THRESHOLD = 10;
export const WALLET_BALANCE_THRESHOLD = 1000 * 1000000;
export const MAX_CHAIN_LOAD = 0.8;
export const HEADER_PHONE_AUTH = 'x-phone-authcode';
export const HEADER_PHONE = 'x-phone';
export const HEADER_HANDLE = 'x-handle';
export const HEADER_RECAPTCHA = 'x-recaptcha';
export const HEADER_TWITTER_ACCESS_TOKEN = 'x-twitter-token';
export const TWITTER_UNLOCK_HEADER = 'x-twitter-credentials';
export const HEADER_JWT_ACCESS_TOKEN = 'x-access-token';
export const HEADER_JWT_SESSION_TOKEN = 'x-session-token';

/**
 * a-z
 * 0-9
 * _
 * -
 * .
 */
export const ALLOWED_CHAR = new RegExp(/^[a-zA-Z|0-9|\-|_|.]*$/g);

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
  return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'master';
}
