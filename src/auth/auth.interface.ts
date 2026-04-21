import { Request } from 'express';

export interface AuthInfo {
  walletAddress: string;
  clientType: ClientType;
  ownerAddress?: string;
}

export interface ReqWithWallet extends Request, AuthInfo {}

export type ClientType = 'OWEN' | 'VALIDATOR';
