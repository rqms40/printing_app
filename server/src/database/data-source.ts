import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';

export function databaseOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DATABASE_HOST ?? 'localhost',
    port: Number(env.DATABASE_PORT ?? 5432),
    username: env.DATABASE_USER ?? 'postgres',
    password: env.DATABASE_PASSWORD ?? 'postgres',
    database: env.DATABASE_NAME ?? 'grid_print',
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
    migrations: [join(__dirname, '..', '..', 'migrations', '*{.ts,.js}')],
    synchronize: false,
  };
}

export const AppDataSource = new DataSource(databaseOptionsFromEnv());
