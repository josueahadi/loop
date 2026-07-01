export interface AppConfig {
  env: string;
  port: number;
  appUrl: string;
  databaseUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
    actionTokenTtlHours: number;
  };
  mail: {
    driver: 'stub' | 'sendgrid';
    sendgridApiKey: string;
    from: string;
    fromName: string;
  };
  admin: {
    email: string;
    password: string;
    name: string;
    phone: string;
  };
  storage: {
    driver: 'stub' | 'firebase';
    serviceAccountPath: string;
    bucket: string;
  };
  matching: {
    // Default "nearby" search radius in km (owner can pass ?radius= to override).
    defaultRadiusKm: number;
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    actionTokenTtlHours: parseInt(process.env.ACTION_TOKEN_TTL_HOURS ?? '24', 10),
  },
  mail: {
    driver: (process.env.MAIL_DRIVER as 'stub' | 'sendgrid') ?? 'stub',
    sendgridApiKey: process.env.SENDGRID_API_KEY ?? '',
    from: process.env.SENDGRID_FROM ?? 'no-reply@loop.rw',
    fromName: process.env.MAIL_FROM_NAME ?? 'Loop',
  },
  admin: {
    email: process.env.ADMIN_EMAIL ?? 'admin@loop.rw',
    password: process.env.ADMIN_PASSWORD ?? 'change-me-admin',
    name: process.env.ADMIN_NAME ?? 'Loop Admin',
    phone: process.env.ADMIN_PHONE ?? '+250780000000',
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER as 'stub' | 'firebase') ?? 'stub',
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? '',
    bucket: process.env.FIREBASE_STORAGE_BUCKET ?? '',
  },
  matching: {
    defaultRadiusKm: parseFloat(process.env.NEARBY_RADIUS_KM ?? '10'),
  },
});
