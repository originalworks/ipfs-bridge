import { Module } from '@nestjs/common';
import { MulterConfigModule } from '../multerConfig/multerConfig.module';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { AuthModule } from '../auth/auth.module';
import { S3Module } from '../s3/s3.module';
import { ConfigModule } from '@nestjs/config';
import { FilebaseModule } from '../filebase/filebase.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MulterConfigModule,
    FilebaseModule,
    AuthModule,
    S3Module,
  ],
  providers: [UploadService],
  controllers: [UploadController],
  exports: [UploadService],
})
export class UploadModule {}
