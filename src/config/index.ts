import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const corsOrigins = (() => {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) return ['http://localhost:3000', 'http://localhost:3001'];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
})();

export default {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || '5000',
  app_name: process.env.APP_NAME || 'My App',
  super_admin_email: process.env.SUPER_ADMIN_EMAIL || 'admin@example.com',
  super_admin_password: assertEnv('SUPER_ADMIN_PASSWORD'),
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS || '12',
  base_url_server: process.env.BASE_URL_SERVER || 'http://localhost:5000',
  base_url_client: process.env.BASE_URL_CLIENT || 'http://localhost:3000',
  cors_origins: corsOrigins,
  email: {
    nodemailer_email: process.env.NODE_MAILER_EMAIL,
    nodemailer_pass: process.env.NODE_MAILER_PASSWORD,
    sender_name: process.env.EMAIL_SENDER_NAME,
    sender_email: process.env.EMAIL,
  },
  jwt: {
    access_secret: assertEnv('JWT_ACCESS_SECRET'),
    access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || '1d',
    refresh_secret: assertEnv('JWT_REFRESH_SECRET'),
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  do_space: {
    endpoints: process.env.DO_SPACE_ENDPOINT,
    access_key: process.env.DO_SPACE_ACCESS_KEY,
    secret_key: process.env.DO_SPACE_SECRET_KEY,
    bucket: process.env.DO_SPACE_BUCKET,
  },
  stripe: {
    published_key: process.env.STRIPE_PUBLISHED_KEY,
    stripe_secret_key: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  sslcommerz: {
    storeId: process.env.SSL_STORE_ID || 'testbox',
    storePass: process.env.SSL_STORE_PASS || 'testbox',
    apiUrl:
      process.env.SSL_API_URL ||
      'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
    validationUrl:
      process.env.SSL_VALIDATION_URL ||
      'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php',
    currency: process.env.SSL_CURRENCY || 'BDT',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    clientId: process.env.FIREBASE_CLIENT_ID,
    clientCertUrl: process.env.FIREBASE_CLIENT_CERT_URL,
  },
};
