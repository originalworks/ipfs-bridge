import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { config } from './config/config';
import { UploadModule } from './upload/upload.module';
import { PinoLoggerModule } from './pinoLogger/pinoLogger.module';
import { DataSourceOptions } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({})
export class AppModule {
  static forDbConnection(dbConfig: DataSourceOptions): DynamicModule {
    const imports = [
      ConfigModule.forRoot({
        load: [config],
        isGlobal: true,
      }),
      TypeOrmModule.forRoot({ ...dbConfig }),
      PinoLoggerModule,
      UploadModule,
    ];

    return {
      module: AppModule,
      imports,
    };
  }
}
