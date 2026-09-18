import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { typeormOptions } from './typeorm-options';

dotenv.config();

export default new DataSource(typeormOptions());
