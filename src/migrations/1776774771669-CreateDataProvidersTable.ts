import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDataProvidersTable1776774771669 implements MigrationInterface {
  name = 'CreateDataProvidersTable1776774771669';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "DataProviders" ("id" SERIAL NOT NULL, "walletAddress" character varying NOT NULL, "bucketName" character varying, "name" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_400a7042dcf95ab224c5c33fb96" UNIQUE ("walletAddress"), CONSTRAINT "PK_9859e68ff0e14ff7e9750b9729e" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "DataProviders"`);
  }
}
