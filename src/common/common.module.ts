import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ExportService } from './export.service';

@Global()
@Module({
    imports: [
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.getOrThrow<string>('JWT_SECRET'),
                signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN', '3d') },
            }),
        })
    ],
    providers: [ExportService],
    exports: [
        JwtModule,
        ExportService
    ]
})
export class CommonModule { }
