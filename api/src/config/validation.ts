import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),
  APP_URL: Joi.string().uri().required(),
  // Comma-separated CORS allow-list; empty allows all (dev only, never in prod).
  CORS_ORIGINS: Joi.string().allow('').default(''),
  DATABASE_URL: Joi.string().required(),
  // TLS on the DB connection. Leave false for the Railway private PostGIS / local
  // compose (no SSL); true only for an external managed DB that requires it.
  DB_SSL: Joi.boolean().default(false),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),
  ACTION_TOKEN_TTL_HOURS: Joi.number().default(24),

  MAIL_DRIVER: Joi.string().valid('stub', 'sendgrid').default('stub'),
  SENDGRID_API_KEY: Joi.string().allow('').optional(),
  SENDGRID_FROM: Joi.string().required(),
  MAIL_FROM_NAME: Joi.string().default('Loop'),

  ADMIN_EMAIL: Joi.string().email().required(),
  ADMIN_PASSWORD: Joi.string().min(8).required(),
  ADMIN_NAME: Joi.string().required(),
  ADMIN_PHONE: Joi.string().required(),

  STORAGE_DRIVER: Joi.string().valid('stub', 'firebase').default('stub'),
  FIREBASE_SERVICE_ACCOUNT_PATH: Joi.string().allow('').optional(),
  // Inline service-account JSON (preferred on Railway — no file to mount).
  FIREBASE_SERVICE_ACCOUNT_JSON: Joi.string().allow('').optional(),
  FIREBASE_STORAGE_BUCKET: Joi.string().allow('').optional(),

  NEARBY_RADIUS_KM: Joi.number().positive().default(10),
  PUSH_DRIVER: Joi.string().valid('stub', 'fcm').default('stub'),

  GEOCODE_SEARCH_URL: Joi.string().uri().optional(),
  GEOCODE_REVERSE_URL: Joi.string().uri().optional(),
  GEOCODE_USER_AGENT: Joi.string().optional(),
  GEOCODE_BIAS_LAT: Joi.number().optional(),
  GEOCODE_BIAS_LNG: Joi.number().optional(),
  GEOCODE_BBOX: Joi.string().optional(),

  ROUTING_OSRM_URL: Joi.string().uri().optional(),
  ROUTING_USER_AGENT: Joi.string().optional(),
  ROUTING_TIMEOUT_MS: Joi.number().optional(),
});
