import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { mkdir, rm } from 'fs/promises';
import { parse, join } from 'path';
import { PinoLoggerDecorator } from '../pinoLogger/logger';
import AdmZip from 'adm-zip';
import type { AuthInfo } from '../auth/auth.interface';
import { S3Service } from '../s3/s3.service';
import { ConfigService } from '@nestjs/config';
import { IConfig } from '../config/config';
import { FilebaseService } from '../filebase/filebase.service';

@Injectable()
export class UploadService {
  private static readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly filebaseService: FilebaseService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService<IConfig>,
  ) {}

  @PinoLoggerDecorator(UploadService.logger)
  async uploadZip(filepath: string, authInfo: AuthInfo) {
    try {
      const extractPath = await this.unzip(filepath);
      const res = await this.filebaseService.upload(extractPath, authInfo);

      if (this.configService.get('BACKUP_TO_IPFS_NODE')) {
        await this.s3Service.uploadFile({
          bucketName: this.configService.get('IPFS_BUCKET_NAME'),
          filePath: filepath,
          key: res.cid,
        });
      }

      UploadService.logger.log({
        textMsg: 'Response',
        response: JSON.stringify(res),
      });

      return res;
    } finally {
      await this.cleanup(filepath);
    }
  }

  private async unzip(filepath: string): Promise<string> {
    const extractPath = join(parse(filepath).dir, 'content');

    await mkdir(extractPath, { recursive: true });

    try {
      new AdmZip(filepath).extractAllTo(extractPath, true);
    } catch (e) {
      const errorMsg = 'Failed to extract ZIP file';

      UploadService.logger.error({
        errorMsg,
        originError: e,
      });
      throw new BadRequestException(errorMsg);
    }

    return extractPath;
  }

  @PinoLoggerDecorator(UploadService.logger)
  async uploadFile(filepath: string, authInfo: AuthInfo) {
    try {
      const res = await this.filebaseService.upload(filepath, authInfo);

      if (this.configService.get('BACKUP_TO_IPFS_NODE')) {
        await this.s3Service.uploadFile({
          bucketName: this.configService.get('IPFS_BUCKET_NAME'),
          filePath: filepath,
          key: res.cid,
        });
      }

      UploadService.logger.log({
        textMsg: 'Response',
        response: JSON.stringify(res),
      });

      return res;
    } finally {
      await this.cleanup(filepath);
    }
  }

  private async cleanup(path: string) {
    await rm(join(path, '..'), { force: true, recursive: true });
  }
}
