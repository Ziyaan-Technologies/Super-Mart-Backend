import { BadRequestException, Controller, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { ActorType } from 'src/common/auth-actor';
import { ActorTypes } from 'src/common/actor-types.decorator';

const folders = ['admin', 'client', 'vendor', 'store', 'category', 'brand', 'product', 'supplier', 'user'];

@ActorTypes(ActorType.ADMIN, ActorType.CLIENT)
@Controller('files')
export class UploadController {
    @Post(':folder/upload')
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 2 * 1024 * 1024 },
        fileFilter(request, file, callback) {
            if (!folders.includes(request.params.folder)) {
                return callback(new BadRequestException('Unknown upload folder'), false);
            }
            if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.mimetype)) {
                return callback(new BadRequestException('Only image files are allowed'), false);
            }
            callback(null, true);
        },
        storage: diskStorage({
            destination(request, _, callback) {
                const directory = join(process.cwd(), 'uploads', request.params.folder);
                if (!existsSync(directory)) {
                    mkdirSync(directory, { recursive: true });
                }
                callback(null, directory);
            },
            filename(_, file, callback) {
                callback(null, `${randomBytes(16).toString('hex')}${extname(file.originalname).toLowerCase()}`);
            }
        })
    }))
    upload(@Param('folder') folder: string, @UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('Please choose a file to upload');
        }
        return {
            url: `${process.env.APP_API_SERVER}uploads/${folder}/${file.filename}`
        };
    }
}
