export interface IConfig {
  ENVIRONMENT: string;
  TEMP_PATH: string;
  DDEX_SEQUENCER_ADDRESS: string;
  SECRETS_PATH: string;
  IPFS_BUCKET_NAME: string;
  BACKUP_TO_IPFS_NODE: boolean;
}

export const config = (): IConfig => ({
  ENVIRONMENT: process.env.ENVIRONMENT,
  TEMP_PATH: process.env.TEMP_PATH,
  DDEX_SEQUENCER_ADDRESS: process.env.DDEX_SEQUENCER_ADDRESS,
  SECRETS_PATH: process.env.SECRETS_PATH,
  IPFS_BUCKET_NAME: process.env.IPFS_BUCKET_NAME,
  BACKUP_TO_IPFS_NODE: Boolean(process.env.BACKUP_TO_IPFS_NODE),
});
