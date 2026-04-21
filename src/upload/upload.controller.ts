import {
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AuthGuard,
  OnlyOwenGuard,
  OnlyValidatorGuard,
} from '../auth/auth.guard';
import { UploadService } from './upload.service';
import type { AuthInfo, ReqWithWallet } from '../auth/auth.interface';
import { UploadZipParamsDto } from './upload.dto';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5mb

@Controller('pin')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('dir/:ownerAddress')
  @UseGuards(AuthGuard, OnlyValidatorGuard)
  @UseInterceptors(FileInterceptor('file'))
  async handleUploadZip(
    @Req() req: ReqWithWallet,
    @Param() params: UploadZipParamsDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: MAX_FILE_SIZE,
            message(maxSize) {
              return `File is too big, max ${maxSize} is accepted`;
            },
          }),
          new FileTypeValidator({
            fileType: 'application/zip',
            skipMagicNumbersValidation: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const authInfo: AuthInfo = {
      clientType: req.clientType,
      walletAddress: req.walletAddress.toLowerCase(),
      ownerAddress: params.ownerAddress.toLowerCase(),
    };

    return await this.uploadService.uploadZip(file.path, authInfo);
  }

  @Post('file')
  @UseGuards(AuthGuard, OnlyOwenGuard)
  @UseInterceptors(FileInterceptor('file'))
  async handleUploadFile(
    @Req() req: ReqWithWallet,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: MAX_FILE_SIZE,
            message(maxSize) {
              return `File is too big, max ${maxSize} is accepted`;
            },
          }),
          new FileTypeValidator({
            fileType: 'image/*',
            skipMagicNumbersValidation: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const authInfo: AuthInfo = {
      clientType: req.clientType,
      walletAddress: req.walletAddress.toLowerCase(),
    };

    return await this.uploadService.uploadFile(file.path, authInfo);
  }
}
