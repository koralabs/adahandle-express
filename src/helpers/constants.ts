export const MAX_SESSION_LENGTH_SPO = 86400000; // 24 hours
export const MAX_SESSION_LENGTH_CLI = 86400000; // 24 hours
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

export const HEADER_JWT_SPO_ACCESS_TOKEN = 'x-spo-access-token';
export const HEADER_JWT_SPO_SESSION_TOKEN = 'x-spo-session-token';

export const HEADER_JWT_ALL_SESSIONS_TOKEN = 'x-all-sessions-token';
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

export const getWalletEndpoint = (): string =>
  process.env.WALLET_ENDPOINT as string;

export const getGraphqlEndpoint = (): string =>
  process.env.GRAPHQL_ENDPOINT as string;

export const getMintingWalletId = (): string => {
  const walletId = process.env.MINT_WALLET_ID;
  if (!walletId) { throw new Error("Couldn't retrieve minting wallet ID"); }
  return walletId.trim();
}

export const getMintingWalletSeedPhrase = (): string => {
  const seed = process.env.MINT_SEED_PHRASE;
  if (!seed) { throw new Error("Couldn't retrieve minting seed phrase"); }

  return JSON.parse(seed.trim());
}

export const getPaymentWalletId = (): string => {
  const walletId = process.env.PAYMENT_WALLET_ID;
  if (!walletId) { throw new Error("Couldn't retrieve payment wallet ID"); }
  return walletId.trim();
}

export const getPaymentWalletSeedPhrase = (): string => {
  const seed = process.env.PAYMENT_SEED_PHRASE;
  if (!seed) { throw new Error("Couldn't retrieve payment seed phrase"); }

  return JSON.parse(seed.trim());
}

export const getPolicyId = (): string => {
  const policyId = process.env.POLICY_ID;

  if (!policyId) { throw new Error("Couldn't retrieve policy ID"); }

  return policyId.trim();
}

export const getPolicyPrivateKey = (): string => {
  const policyKey = process.env.POLICY_KEY;

  if (!policyKey) { throw new Error("Couldn't retrieve policy key"); }

  return policyKey.trim();
}

export const getMintingWallet = (index: number): { walletId: string; seedPhrase: string } => {
  const walletId = process.env[`MINT_WALLET_ID_${index}`];
  const seedPhrase = process.env[`MINT_WALLET_SEED_PHRASE_${index}`];

  if (!walletId || !seedPhrase) { throw new Error("Couldn't retrieve minting wallet ID or seed phrase"); }

  return {
    walletId,
    seedPhrase
  }
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