import type { Knex } from 'knex';

try {
  process.loadEnvFile();
} catch (error) {
  // ignore if already loaded or not supported
}

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './src/database/migrations',
      extension: 'ts',
    },
  },
  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './dist/src/database/migrations',
      extension: 'js',
    },
  },
};

export default config;
module.exports = config; // Expose as both default export and module.exports for maximum compatibility
