import { IsEthereumAddress } from 'class-validator';

export class UploadZipParamsDto {
  @IsEthereumAddress()
  ownerAddress: string;
}
