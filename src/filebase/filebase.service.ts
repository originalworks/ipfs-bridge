import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PinoLoggerDecorator } from '../pinoLogger/logger';
import path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { DataProvider } from './filebase.entity';
import { Repository } from 'typeorm';
import type { AuthInfo } from '../auth/auth.interface';
import { Writable } from 'node:stream';
import { createReadStream, createWriteStream } from 'node:fs';
import { parse } from 'node:path';
import { open } from 'fs/promises';
import { UploadResponse } from './filebase.types';
import { serializeError } from '../utils/serializeError';
import { ConfigService } from '@nestjs/config';
import { IConfig } from '../config/config';

@Injectable()
export class FilebaseService {
  private static readonly logger = new Logger(FilebaseService.name);
  constructor(
    protected filebaseS3Client: S3Client,
    @InjectRepository(DataProvider)
    private dataProvidersRepo: Repository<DataProvider>,
    private readonly configService: ConfigService<IConfig>,
  ) {}

  private placeholderCID: ReturnType<
    (typeof import('multiformats/cid').CID)['parse']
  >;

  private async getPlaceholderCID() {
    if (!this.placeholderCID) {
      const { CID } = await import('multiformats/cid');
      this.placeholderCID = CID.parse(
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      );
    }
    return this.placeholderCID;
  }

  private CarWriter: typeof import('@ipld/car/writer').CarWriter;
  private async getCarWriter() {
    if (!this.CarWriter) {
      this.CarWriter = (await import('@ipld/car/writer')).CarWriter;
    }
    return this.CarWriter;
  }

  private filesFromPath: typeof import('files-from-path').filesFromPaths;
  private async getFilesFromPath() {
    if (!this.filesFromPath) {
      this.filesFromPath = (await import('files-from-path')).filesFromPaths;
    }
    return this.filesFromPath;
  }

  private ipfsCar: typeof import('ipfs-car');
  private async getIpfsCar() {
    if (!this.ipfsCar) {
      this.ipfsCar = await import('ipfs-car');
    }
    return this.ipfsCar;
  }

  @PinoLoggerDecorator(FilebaseService.logger)
  private async getOwnerBucket(authInfo: AuthInfo): Promise<string> {
    const { walletAddress, dataProviderAddress } = authInfo;

    // Validators don't own their own storage
    const lookupAddress = dataProviderAddress ?? walletAddress;

    const dataProvider = await this.dataProvidersRepo.findOneBy({
      walletAddress: lookupAddress,
    });

    if (!dataProvider) {
      const errorMsg = `No storage found for address ${lookupAddress}. If you should have one please contact admin@original.works`;

      FilebaseService.logger.error({
        errorMsg,
      });

      throw new NotFoundException(errorMsg);
    }

    FilebaseService.logger.log({ dataProvider });

    const bucketName = (
      dataProvider.bucketName ??
      `${dataProvider.name}-${Math.random()
        .toString(36)
        .slice(2, 2 + 4)}`
    ).toLowerCase(); // 4 random letters

    try {
      await this.filebaseS3Client.send(
        new HeadBucketCommand({ Bucket: bucketName }),
      );

      FilebaseService.logger.log('Bucket exists');
    } catch (err) {
      // Create new bucket headBucket throws 404
      if (
        '$metadata' in err &&
        'httpStatusCode' in err.$metadata &&
        err.$metadata.httpStatusCode === 404
      ) {
        FilebaseService.logger.log(`Bucket doesn't exist, creating...`);
        try {
          await this.filebaseS3Client.send(
            new CreateBucketCommand({ Bucket: bucketName }),
          );
          FilebaseService.logger.log(`Bucket created`);

          if (!dataProvider.bucketName) {
            await this.dataProvidersRepo.update(
              { walletAddress: lookupAddress },
              { bucketName },
            );
            FilebaseService.logger.log(`Bucket name saved to DB`);
          }
        } catch (err) {
          const errorMsg = `Failed to resolve owner space. If problem persists please contact admin@original.works`;

          FilebaseService.logger.error({
            errorMsg,
            newEntry: !!dataProvider.bucketName,
            bucketName,
            filebaseError: err.message,
          });

          throw new BadGatewayException(errorMsg);
        }
      } else {
        const errorMsg = `Failed to resolve owner space. If problem persists please contact admin@original.works`;

        FilebaseService.logger.error({
          errorMsg,
          newEntry: !!dataProvider.bucketName,
          bucketName,
          filebaseError: err.message,
        });

        throw new BadGatewayException(errorMsg);
      }
    }
    return bucketName;
  }

  @PinoLoggerDecorator(FilebaseService.logger)
  private async createCar(fileOrDirPath: string) {
    const {
      createFileEncoderStream,
      createDirectoryEncoderStream,
      CAREncoderStream,
    } = await this.getIpfsCar();
    const CarWriter = await this.getCarWriter();
    const filesFromPaths = await this.getFilesFromPath();
    const placeholderCID = await this.getPlaceholderCID();

    const carDir = parse(fileOrDirPath).dir;
    const carName = `${path.basename(carDir)}.car`;
    const carPath = path.join(carDir, carName);

    const files = await filesFromPaths(fileOrDirPath);

    FilebaseService.logger.log({
      textMsg: 'Files to be uploaded to Filebase',
      files: files.map((item) => ({
        file: item.name,
        size: `${item.size / 1000} kB`,
      })),
    });

    const blockStream =
      files.length === 1
        ? createFileEncoderStream(files[0])
        : createDirectoryEncoderStream(files);

    const carEncoderStream = new CAREncoderStream([placeholderCID]);
    const outStream = Writable.toWeb(createWriteStream(carPath));
    await blockStream.pipeThrough(carEncoderStream).pipeTo(outStream);

    const rootCID = carEncoderStream.finalBlock?.cid;

    if (!rootCID) {
      const errorMsg = `Failed to create CAR - No blocks in CAR`;
      FilebaseService.logger.error({
        errorMsg,
      });
      throw new InternalServerErrorException(errorMsg);
    }

    const fd = await open(carPath, 'r+');
    // @ts-expect-error sure
    await CarWriter.updateRootsInFile(fd, [rootCID]);
    await fd.close();

    return {
      cid: rootCID.toString(),
      carPath,
      carName,
    };
  }

  @PinoLoggerDecorator(FilebaseService.logger)
  public async upload(
    fileOrDirPath: string,
    authInfo: AuthInfo,
  ): Promise<UploadResponse> {
    const bucketName = await this.getOwnerBucket(authInfo);
    const { carPath, cid: computedCid } = await this.createCar(fileOrDirPath);

    const cmd = new PutObjectCommand({
      Bucket: bucketName,
      Key: computedCid,
      Body: createReadStream(carPath),
      Metadata: {
        import: 'car',
      },
    });

    let filebaseCid: string;

    cmd.middlewareStack.add(
      (next) => async (args) => {
        const result = await next(args);
        const headers = (result.response as any)?.headers;
        const resCid = headers?.['x-amz-meta-cid'];

        if (resCid) {
          filebaseCid = resCid;
        }

        return result;
      },
      {
        step: 'deserialize',
        name: 'captureFilebaseCid',
      },
    );

    try {
      await this.filebaseS3Client.send(cmd);

      if (!filebaseCid) {
        FilebaseService.logger.warn({
          textMsg: `Upload successful but Filebase didn't return CID in response header`,
          computedCid,
          filebaseCid,
        });
      } else if (filebaseCid !== computedCid) {
        FilebaseService.logger.warn({
          textMsg: 'Upload successful but CID Mismatch',
          computedCid,
          filebaseCid,
        });
      }
    } catch (err) {
      FilebaseService.logger.error({
        errorMsg: 'Failed to upload files to Filebase',
        originError: serializeError(err),
      });

      throw new InternalServerErrorException('Failed to upload file');
    }

    const cid = filebaseCid ?? computedCid;

    return {
      cid,
      url: `${this.configService.get('IPFS_GATEWAY_URL')}/ipfs/${cid}`,
    };
  }
}
