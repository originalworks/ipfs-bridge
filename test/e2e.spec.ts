jest.setTimeout(100000);

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { join } from 'path';
import { HDNodeWallet } from 'ethers';
import { ConfigModule } from '@nestjs/config';
import { rm } from 'fs/promises';
import { ClientType } from '../src/auth/auth.interface';
import { testFixture } from './fixture';
import { IConfig } from '../src/config/config';
import { Secrets } from '../src/awsSecrets/awsSecrets.module';
import { ISecrets } from '../src/awsSecrets/awsSecrets.interface';
import { TypeOrmModule } from '@nestjs/typeorm';
import { testDbConfig } from '../src/config/dbConfig';
import { UploadModule } from '../src/upload/upload.module';
import { DataSource, Repository } from 'typeorm';
import { Factory, getFactory } from './factory';
import { clearDatabase } from './typeorm.utils';
import { S3Client } from '@aws-sdk/client-s3';
import {
  recreateBucket,
  existsInBucket,
  bucketExists,
  deleteAllBuckets,
} from './s3Utils';
import { UploadService } from '../src/upload/upload.service';
import { Bucket as BucketEntity } from '../src/filebase/filebase.entity';

describe('AppController', () => {
  let factory: Factory;
  let app: INestApplication;
  let dataSource: DataSource;
  let fixture: Awaited<ReturnType<typeof testFixture>>;
  let bucketsRepo: Repository<BucketEntity>;
  let uploadService: UploadService;

  const s3TestClient = new S3Client({
    endpoint: 'http://localstack:4566',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
    forcePathStyle: true,
  });

  const IPFS_BUCKET_NAME = 'ipfs-bucket';

  const auth: { owen1?: string; owen2?: string; validator?: string } = {};

  const TEMP_PATH = join(__dirname, 'temp');

  const getAuth = async (client: ClientType, wallet: HDNodeWallet) => {
    const signature = await wallet.signMessage(client);
    const auth = [client, signature].join('::');

    return auth;
  };

  beforeAll(async () => {
    fixture = await testFixture();

    auth.owen1 = await getAuth('OWEN', fixture.wallets.owen1);
    auth.owen2 = await getAuth('OWEN', fixture.wallets.owen2);
    auth.validator = await getAuth('VALIDATOR', fixture.wallets.validator);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({ ...testDbConfig() }),
        ConfigModule.forRoot({
          load: [
            async (): Promise<Partial<IConfig>> => ({
              TEMP_PATH,
              SECRETS_PATH: 'secrets-path',
              ENVIRONMENT: 'test',
              DDEX_SEQUENCER_ADDRESS: await fixture.sequencer.getAddress(),
              IPFS_BUCKET_NAME,
              BACKUP_TO_IPFS_NODE: true,
            }),
          ],
          isGlobal: true,
        }),
        UploadModule,
      ],
    })
      .overrideProvider(Secrets)
      .useValue({
        RPC_URL: fixture.rpcUrl,
      } as ISecrets)
      .compile();

    dataSource = module.get(DataSource);
    factory = getFactory(dataSource);
    bucketsRepo = dataSource.getRepository(BucketEntity);
    uploadService = module.get(UploadService);
    app = module.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    await factory.createMany<BucketEntity>(BucketEntity.name, [
      {
        walletAddress: fixture.wallets.owen1.address.toLowerCase(),
      },
      {
        walletAddress: fixture.wallets.owen2.address.toLowerCase(),
      },
    ]);

    await recreateBucket(s3TestClient, IPFS_BUCKET_NAME);
  });

  afterAll(async () => {
    await rm(TEMP_PATH, { recursive: true, force: true });
    jest.clearAllMocks();
    await clearDatabase(dataSource);
    await app.close();
  });

  describe('IPFS Bridge', () => {
    describe('Auth', () => {
      it('Fails without authorization header', async () => {
        const res = await request(app.getHttpServer())
          .post(`/pin/dir/${fixture.wallets.owen1.address}`)
          .expect(401);
        expect(res.text).toEqual(
          `{"message":"Missing authorization header","error":"Unauthorized","statusCode":401}`,
        );
      });

      it('Fails on malformed authorization header', async () => {
        let res = await request(app.getHttpServer())
          .post(`/pin/dir/${fixture.wallets.owen1.address}`)
          .set('authorization', 'HYDRAULIK::TOMASZ')
          .expect(401);

        expect(res.text).toEqual(
          `{"message":"Invalid client type in signed message","error":"Unauthorized","statusCode":401}`,
        );

        res = await request(app.getHttpServer())
          .post(`/pin/dir/${fixture.wallets.owen1.address}`)
          .set('authorization', 'OWEN::TOMASZ')
          .expect(401);

        expect(res.text).toEqual(
          `{"message":"Malformed signature in authorization header","error":"Unauthorized","statusCode":401}`,
        );
      });

      it('Fails on whitelist', async () => {
        let res = await request(app.getHttpServer())
          .post(`/pin/dir/${fixture.wallets.owen1.address}`)
          .set(
            'authorization',
            await getAuth('OWEN', fixture.wallets.validator),
          )
          .expect(401);

        expect(res.text).toEqual(
          `{"message":"Address ${fixture.wallets.validator.address} is not whitelisted on OWEN whitelist","error":"Unauthorized","statusCode":401}`,
        );

        res = await request(app.getHttpServer())
          .post(`/pin/dir/${fixture.wallets.owen1.address}`)
          .set(
            'authorization',
            await getAuth('VALIDATOR', fixture.wallets.owen1),
          )
          .expect(401);

        expect(res.text).toEqual(
          `{"message":"Address ${fixture.wallets.owen1.address} is not whitelisted on VALIDATOR whitelist","error":"Unauthorized","statusCode":401}`,
        );
      });
    });

    describe('Upload controller', () => {
      describe('/POST pin/dir', () => {
        it('Rejects when no file attached', async () => {
          const res = await request(app.getHttpServer())
            .post(`/pin/dir/${fixture.wallets.owen1.address}`)
            .set('authorization', auth.validator)
            .expect(400);

          expect(res.text).toEqual(
            `{"message":"File is required","error":"Bad Request","statusCode":400}`,
          );
        });

        it('Rejects when no ownerAddress added or not 0x address', async () => {
          const file = join(__dirname, './test.zip');

          let res = await request(app.getHttpServer())
            .post(`/pin/dir`)
            .set('authorization', auth.validator)
            .expect(404);

          res = await request(app.getHttpServer())
            .post(`/pin/dir/zenek-martyniuk`)
            .set('authorization', auth.validator)
            .attach('file', file)
            .expect(400);

          expect(res.text).toEqual(
            `{"message":["ownerAddress must be an Ethereum address"],"error":"Bad Request","statusCode":400}`,
          );
        });

        it('Rejects non zip files', async () => {
          const file = join(__dirname, './test.jpeg');

          const res = await request(app.getHttpServer())
            .post(`/pin/dir/${fixture.wallets.owen1.address}`)
            .set('authorization', auth.validator)
            .attach('file', file)
            .expect(400);

          expect(res.text).toEqual(
            `{"message":"Validation failed (current file type is image/jpeg, expected type is application/zip)","error":"Bad Request","statusCode":400}`,
          );
        });

        it('Rejects when called by non-validator', async () => {
          const file = join(__dirname, './test.zip');

          const res = await request(app.getHttpServer())
            .post(`/pin/dir/${fixture.wallets.owen1.address}`)
            .set('authorization', auth.owen1)
            .attach('file', file)
            .expect(401);

          expect(res.text).toEqual(
            `{"message":"Only Validators can use this endpoint","error":"Unauthorized","statusCode":401}`,
          );
        });

        it('Processes zip', async () => {
          const file = join(__dirname, './test.zip');
          const expectedCID =
            'bafybeibrqxxbs5wzbkic3mpao2o2jaxaznvvdt3upirev2r5frh3tgvekq'; //original cid of test.zip content

          let fileExists = await existsInBucket(
            s3TestClient,
            IPFS_BUCKET_NAME,
            `${expectedCID}.zip`,
          );

          expect(fileExists).toEqual(false);

          const res = await request(app.getHttpServer())
            .post(`/pin/dir/${fixture.wallets.owen1.address}`)
            .set('authorization', auth.validator)
            .attach('file', file)
            .expect(201);

          expect(res.body.cid).toBeDefined();
          expect(typeof res.body.cid).toBe('string');
          expect(expectedCID).toEqual(res.body.cid);

          expect(res.body.url).toBeDefined();
          expect(typeof res.body.url).toBe('string');

          fileExists = await existsInBucket(
            s3TestClient,
            IPFS_BUCKET_NAME,
            `${res.body.cid}.zip`,
          );
          expect(fileExists).toEqual(true);
        });
      });

      describe('/POST pin/file', () => {
        it('Rejects when no file attached', async () => {
          const res = await request(app.getHttpServer())
            .post('/pin/file')
            .set('authorization', auth.owen1)
            .expect(400);

          expect(res.text).toEqual(
            `{"message":"File is required","error":"Bad Request","statusCode":400}`,
          );
        });

        it('Rejects non image files', async () => {
          const file = join(__dirname, './test.zip');

          const res = await request(app.getHttpServer())
            .post('/pin/file')
            .set('authorization', auth.owen1)
            .attach('file', file)
            .expect(400);

          expect(res.text).toEqual(
            `{"message":"Validation failed (current file type is application/zip, expected type is image/*)","error":"Bad Request","statusCode":400}`,
          );
        });

        it('Rejects when called by non-owen', async () => {
          const file = join(__dirname, './test.jpeg');

          const res = await request(app.getHttpServer())
            .post('/pin/file')
            .set('authorization', auth.validator)
            .attach('file', file)
            .expect(401);

          expect(res.text).toEqual(
            `{"message":"Only Data Providers can use this endpoint","error":"Unauthorized","statusCode":401}`,
          );
        });

        it('Assumes file extension if its missing', async () => {
          const file = join(__dirname, './test');

          const uploadServiceSpy = jest.spyOn(uploadService, 'uploadFile');

          await request(app.getHttpServer())
            .post('/pin/file')
            .set('authorization', auth.owen1)
            .attach('file', file, {
              contentType: 'image/jpeg',
            })
            .expect(201);

          expect(uploadServiceSpy).toHaveBeenCalledWith(
            expect.stringMatching(/\.(jpe?g)$/),
            expect.any(Object),
          );

          uploadServiceSpy.mockReset();
          await request(app.getHttpServer())
            .post('/pin/file')
            .set('authorization', auth.owen1)
            .attach('file', file, {
              contentType: 'image/unknownmime',
            })
            .expect(201);

          expect(uploadServiceSpy).toHaveBeenCalledWith(
            expect.stringMatching(/\/test$/),
            expect.any(Object),
          );

          uploadServiceSpy.mockRestore();
        });

        it('Processes file', async () => {
          const file = join(__dirname, './test.jpeg');

          const expectedCID =
            'bafkreihl4orpvb76fcdwot4msl6dhsglgqhy2mklbll5xyc5anywdk2blq'; //original cid of test.jpeg;

          let fileExists = await existsInBucket(
            s3TestClient,
            IPFS_BUCKET_NAME,
            `${expectedCID}.jpeg`,
          );

          expect(fileExists).toEqual(false);

          const res = await request(app.getHttpServer())
            .post('/pin/file')
            .set('authorization', auth.owen1)
            .attach('file', file)
            .expect(201);

          expect(res.body.cid).toBeDefined();
          expect(typeof res.body.cid).toBe('string');
          expect(expectedCID).toEqual(res.body.cid);

          expect(res.body.url).toBeDefined();
          expect(typeof res.body.url).toBe('string');

          fileExists = await existsInBucket(
            s3TestClient,
            IPFS_BUCKET_NAME,
            `${res.body.cid}.jpeg`,
          );
          expect(fileExists).toEqual(true);
        });
      });
    });

    describe('Buckets management', () => {
      const file = join(__dirname, './test.jpeg');
      const fileZip = join(__dirname, './test.zip');

      beforeEach(async () => {
        await clearDatabase(dataSource);
        await deleteAllBuckets(s3TestClient, [IPFS_BUCKET_NAME]);
      });

      it('Throws when data provider has not been set in db', async () => {
        let res = await request(app.getHttpServer())
          .post('/pin/file')
          .set('authorization', auth.owen1)
          .attach('file', file)
          .expect(404);

        expect(res.text).toEqual(
          `{"message":"No storage found for address ${fixture.wallets.owen1.address.toLowerCase()}. If you should have one please contact admin@original.works","error":"Not Found","statusCode":404}`,
        );

        res = await request(app.getHttpServer())
          .post(`/pin/dir/${fixture.wallets.owen1.address}`)
          .set('authorization', auth.validator)
          .attach('file', fileZip)
          .expect(404);

        expect(res.text).toEqual(
          `{"message":"No storage found for address ${fixture.wallets.owen1.address.toLowerCase()}. If you should have one please contact admin@original.works","error":"Not Found","statusCode":404}`,
        );
      });

      it('Creates new bucket for newly added data provider', async () => {
        const [owen1, owen2] = await factory.createMany<BucketEntity>(
          BucketEntity.name,
          [
            {
              walletAddress: fixture.wallets.owen1.address.toLowerCase(),
              bucketName: null,
            },
            {
              walletAddress: fixture.wallets.owen2.address.toLowerCase(),
              bucketName: null,
            },
          ],
        );

        expect(owen1.bucketName).toBeNull();
        expect(owen2.bucketName).toBeNull();

        await request(app.getHttpServer())
          .post('/pin/file')
          .set('authorization', auth.owen1)
          .attach('file', file)
          .expect(201);

        await request(app.getHttpServer())
          .post(`/pin/dir/${fixture.wallets.owen2.address}`)
          .set('authorization', auth.validator)
          .attach('file', fileZip)
          .expect(201);

        const owen1After = await bucketsRepo.findOneBy({ id: owen1.id });
        const owen2After = await bucketsRepo.findOneBy({ id: owen2.id });

        expect(owen1After.bucketName).toBeDefined();
        expect(owen2After.bucketName).toBeDefined();

        expect(
          await bucketExists(s3TestClient, owen1After.bucketName),
        ).toBeTruthy();

        expect(
          await bucketExists(s3TestClient, owen2After.bucketName),
        ).toBeTruthy();
      });

      it('Creates bucket when bucketName is set but not found in S3', async () => {
        const [owen1, owen2] = await factory.createMany<BucketEntity>(
          BucketEntity.name,
          [
            {
              walletAddress: fixture.wallets.owen1.address.toLowerCase(),
              bucketName: 'eloszki',
            },
            {
              walletAddress: fixture.wallets.owen2.address.toLowerCase(),
              bucketName: 'heheszki',
            },
          ],
        );

        expect(await bucketExists(s3TestClient, owen1.bucketName)).toBeFalsy();
        expect(await bucketExists(s3TestClient, owen2.bucketName)).toBeFalsy();

        await request(app.getHttpServer())
          .post('/pin/file')
          .set('authorization', auth.owen1)
          .attach('file', file)
          .expect(201);

        await request(app.getHttpServer())
          .post(`/pin/dir/${fixture.wallets.owen2.address}`)
          .set('authorization', auth.validator)
          .attach('file', fileZip)
          .expect(201);

        expect(await bucketExists(s3TestClient, owen1.bucketName)).toBeTruthy();
        expect(await bucketExists(s3TestClient, owen2.bucketName)).toBeTruthy();
      });
    });
  });
});
