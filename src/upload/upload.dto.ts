import { IsEthereumAddress } from 'class-validator';

export class UploadZipParamsDto {
  @IsEthereumAddress()
  dataProviderAddress: string;
}
