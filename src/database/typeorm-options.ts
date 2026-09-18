import { DataSourceOptions } from 'typeorm';
import { join } from 'path';

export function typeormOptions(): DataSourceOptions {
    return {
        type: 'mysql',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        username: process.env.DB_USER_NAME,
        password: process.env.DB_USER_PASSWORD,
        database: process.env.DB_NAME,
        entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
        migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
        synchronize: false,
        migrationsRun: false,
        logging: false,
    };
}
