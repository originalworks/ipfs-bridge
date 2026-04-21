export interface IConfig {
  ENVIRONMENT: string;
  TEMP_PATH: string;
  DDEX_SEQUENCER_ADDRESS: string;
  SECRETS_PATH: string;
  IPFS_BUCKET_NAME: string;
  BACKUP_TO_IPFS_NODE: boolean;
  IPFS_GATEWAY_URL: string;
}

const normalizeUrl = (url?: string): string | undefined => {
  if (!url) return url;
  const normalized = url.trim();
  return normalized.endsWith('/') ? normalized.replace(/\/+$/, '') : normalized;
};

export const config = (): IConfig => ({
  ENVIRONMENT: process.env.ENVIRONMENT,
  TEMP_PATH: process.env.TEMP_PATH,
  DDEX_SEQUENCER_ADDRESS: process.env.DDEX_SEQUENCER_ADDRESS,
  SECRETS_PATH: process.env.SECRETS_PATH,
  IPFS_BUCKET_NAME: process.env.IPFS_BUCKET_NAME,
  BACKUP_TO_IPFS_NODE: Boolean(process.env.BACKUP_TO_IPFS_NODE),
  IPFS_GATEWAY_URL: normalizeUrl(process.env.IPFS_GATEWAY_URL),
});
