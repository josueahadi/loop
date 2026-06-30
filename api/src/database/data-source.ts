import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

// Single TypeORM DataSource used by both the Nest app and the CLI (migrations/seeds).
// synchronize is always false — schema changes go through migrations only.
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../modules/**/entities/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
