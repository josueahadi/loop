export interface AppConfig {
  env: string;
  port: number;
  appUrl: string;
  // Comma-separated CORS allow-list (admin origin, etc.). Empty = allow all (dev only).
  corsOrigins: string;
  databaseUrl: string;
  // Require TLS on the DB connection. Default false: the Railway private PostGIS
  // (and local compose) have no SSL. Set true only for an external managed DB.
  dbSsl: boolean;
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
    // Either a path to the service-account JSON file, or the JSON inline
    // (FIREBASE_SERVICE_ACCOUNT_JSON) — the latter is preferred on Railway where
    // there is no file to mount. Inline takes precedence when both are set.
    serviceAccountPath: string;
    serviceAccountJson: string;
    bucket: string;
  };
  matching: {
    // Default "nearby" search radius in km (owner can pass ?radius= to override).
    defaultRadiusKm: number;
  };
  push: {
    // stub = log notifications (dev); fcm = real Firebase Cloud Messaging.
    driver: 'stub' | 'fcm';
  };
  payments: {
    // stub = log + auto-succeed after a delay (dev, no creds);
    // flutterwave = v3 hosted checkout; flutterwave_v4 = v4 charge + redirect.
    driver: 'stub' | 'flutterwave' | 'flutterwave_v4';
    // Flutterwave test-mode keys (env-only, never committed).
    flutterwavePublicKey: string;
    flutterwaveSecretKey: string;
    flutterwaveEncryptionKey: string;
    // v4 OAuth client credentials (developer sandbox: Client ID + Client Secret).
    flutterwaveClientId: string;
    flutterwaveClientSecret: string;
    // v4 needs an HTTPS redirect (rejects custom schemes) + a MoMo test msisdn.
    v4RedirectUrl: string;
    v4MomoPhone: string;
    // Secret hash: v3 sends it verbatim in verif-hash; v4 uses it as the
    // HMAC-SHA256 key over the raw body (flutterwave-signature header).
    flutterwaveWebhookHash: string;
    // Base URL Flutterwave redirects the browser back to after checkout (a deep
    // link Loop handles); and the API's own base for building tx callbacks.
    redirectUrl: string;
  };
  geocode: {
    // OSM providers (swappable). Search = Photon, reverse = Nominatim.
    searchUrl: string;
    reverseUrl: string;
    // Required by OSM usage policy — a descriptive, contactable UA.
    userAgent: string;
    // Kigali bias so search-as-you-type prefers local results.
    biasLat: number;
    biasLng: number;
    bbox: string; // "minLon,minLat,maxLon,maxLat"
  };
  routing: {
    // OSRM base URL. Defaults to the public demo server, which is rate-limited
    // and carries no uptime guarantee — point this at a self-hosted Rwanda
    // extract for production (a config change, not a rewrite).
    baseUrl: string;
    // Descriptive UA, same courtesy as the geocode proxy.
    userAgent: string;
    // Give up quickly: pricing falls back to great-circle rather than making the
    // owner wait on a slow third party.
    timeoutMs: number;
  };
}

export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  corsOrigins: process.env.CORS_ORIGINS ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  dbSsl: process.env.DB_SSL === 'true',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    actionTokenTtlHours: parseInt(
      process.env.ACTION_TOKEN_TTL_HOURS ?? '24',
      10,
    ),
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
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '',
    bucket: process.env.FIREBASE_STORAGE_BUCKET ?? '',
  },
  matching: {
    defaultRadiusKm: parseFloat(process.env.NEARBY_RADIUS_KM ?? '10'),
  },
  push: {
    driver: (process.env.PUSH_DRIVER as 'stub' | 'fcm') ?? 'stub',
  },
  payments: {
    driver:
      (process.env.PAYMENT_DRIVER as
        | 'stub'
        | 'flutterwave'
        | 'flutterwave_v4') ?? 'stub',
    flutterwavePublicKey: process.env.FLUTTERWAVE_PUBLIC_KEY ?? '',
    flutterwaveSecretKey: process.env.FLUTTERWAVE_SECRET_KEY ?? '',
    flutterwaveEncryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY ?? '',
    flutterwaveClientId: process.env.FLUTTERWAVE_CLIENT_ID ?? '',
    flutterwaveClientSecret: process.env.FLUTTERWAVE_CLIENT_SECRET ?? '',
    v4RedirectUrl: process.env.FLUTTERWAVE_V4_REDIRECT_URL ?? '',
    v4MomoPhone: process.env.FLUTTERWAVE_V4_MOMO_PHONE ?? '0780000000',
    flutterwaveWebhookHash: process.env.FLUTTERWAVE_WEBHOOK_HASH ?? '',
    redirectUrl: process.env.PAYMENT_REDIRECT_URL ?? 'loop://payment-callback',
  },
  geocode: {
    searchUrl: process.env.GEOCODE_SEARCH_URL ?? 'https://photon.komoot.io/api',
    reverseUrl:
      process.env.GEOCODE_REVERSE_URL ??
      'https://nominatim.openstreetmap.org/reverse',
    userAgent:
      process.env.GEOCODE_USER_AGENT ?? 'LoopApp/0.1 (ahadihjosue@gmail.com)',
    biasLat: parseFloat(process.env.GEOCODE_BIAS_LAT ?? '-1.9441'),
    biasLng: parseFloat(process.env.GEOCODE_BIAS_LNG ?? '30.0619'),
    // Greater Kigali bounding box.
    bbox: process.env.GEOCODE_BBOX ?? '29.9,-2.10,30.30,-1.80',
  },
  routing: {
    baseUrl: process.env.ROUTING_OSRM_URL ?? 'https://router.project-osrm.org',
    userAgent:
      process.env.ROUTING_USER_AGENT ?? 'LoopApp/0.1 (ahadihjosue@gmail.com)',
    timeoutMs: parseInt(process.env.ROUTING_TIMEOUT_MS ?? '6000', 10),
  },
});
