export const config = {
  port: parseInt(process.env.API_PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev',
  nodeEnv: process.env.NODE_ENV || 'development',
};