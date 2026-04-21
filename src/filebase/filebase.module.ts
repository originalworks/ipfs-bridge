import { Module } from '@nestjs/common';
import { FilebaseService } from './filebase.service';
import { AwsSecretsModule } from '../awsSecrets/awsSecrets.module';
import { DataProvider } from './filebase.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilebaseS3Factory } from './filebaseS3Factory';

@Module({
  imports: [AwsSecretsModule, TypeOrmModule.forFeature([DataProvider])],
  providers: [FilebaseService, FilebaseS3Factory],
  exports: [FilebaseService],
})
export class FilebaseModule {}
