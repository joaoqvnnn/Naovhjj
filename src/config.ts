import dotenv from 'dotenv';
dotenv.config();

interface Config {
  botToken: string;
  databaseUrl: string;
  mpAccessToken: string;
  mpPublicKey: string;
  mpWebhookSecret: string;
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
  web: {
    url: string;
    secret: string;
  };
}

function getEnv(key: string, required = true): string {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Variável de ambiente ${key} não definida.`);
  }
  return value || '';
}

const config: Config = {
  botToken: getEnv('BOT_TOKEN'),
  databaseUrl: getEnv('DATABASE_URL'),
  mpAccessToken: getEnv('MP_ACCESS_TOKEN'),
  mpPublicKey: getEnv('MP_PUBLIC_KEY'),
  mpWebhookSecret: getEnv('MP_WEBHOOK_SECRET'),
  smtp: {
    host: getEnv('SMTP_HOST'),
    port: parseInt(getEnv('SMTP_PORT') || '587', 10),
    user: getEnv('SMTP_USER'),
    pass: getEnv('SMTP_PASS'),
    from: getEnv('SMTP_FROM'),
  },
  web: {
    url: getEnv('WEB_URL'),
    secret: getEnv('WEB_SECRET'),
  },
};

export default config;
