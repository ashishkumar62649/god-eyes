import { z } from 'zod';

const DEFAULT_PORT = 4000;
const DEFAULT_DATABASE_URL = 'postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev';
const DEFAULT_NODE_ENV = 'development';
const ALLOWED_NODE_ENV = ['development', 'test', 'production'] as const;

const PortSchema = z
  .string()
  .regex(/^\d+$/, { message: 'API_PORT must be a positive integer string (e.g. "4000")' })
  .transform((v) => parseInt(v, 10))
  .pipe(z.number().int().min(1).max(65535));

const DatabaseUrlSchema = z
  .string()
  .min(1, { message: 'DATABASE_URL must not be empty if set' })
  .url({ message: 'DATABASE_URL must be a valid URL' });

const NodeEnvSchema = z.enum(ALLOWED_NODE_ENV, {
  errorMap: () => ({
    message: `NODE_ENV must be one of: ${ALLOWED_NODE_ENV.join(', ')}`,
  }),
});

const EmptyOrValue = <T extends z.ZodTypeAny>(value: T) =>
  z.union([z.literal(''), value]).optional();

const EnvSchema = z.object({
  API_PORT: EmptyOrValue(PortSchema).transform((v) =>
    v === undefined || v === '' ? DEFAULT_PORT : v,
  ),
  DATABASE_URL: EmptyOrValue(DatabaseUrlSchema).transform((v) =>
    v === undefined || v === '' ? DEFAULT_DATABASE_URL : v,
  ),
  NODE_ENV: EmptyOrValue(NodeEnvSchema).transform((v) =>
    v === undefined || v === '' ? DEFAULT_NODE_ENV : v,
  ),
});

type ValidatedEnv = {
  API_PORT: number;
  DATABASE_URL: string;
  NODE_ENV: (typeof ALLOWED_NODE_ENV)[number];
};

function redactedValueForError(envName: string): string {
  const raw = process.env[envName];
  if (raw === undefined) return '(unset)';
  if (raw === '') return '(empty string)';
  if (envName === 'DATABASE_URL') {
    return '[REDACTED — contains credentials]';
  }
  return JSON.stringify(raw);
}

function formatConfigError(error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => {
      const path = issue.path.join('.') || '(root)';
      const envName = typeof issue.path[0] === 'string' ? issue.path[0] : path;
      const displayValue = redactedValueForError(envName);
      return `  - ${envName}: ${issue.message} (received: ${displayValue})`;
    })
    .join('\n');
  return [
    '[config] Invalid API configuration detected.',
    'Fix the following environment variable(s) and restart the API:',
    issues,
  ].join('\n');
}

export function loadConfig(): {
  port: number;
  databaseUrl: string;
  nodeEnv: (typeof ALLOWED_NODE_ENV)[number];
} {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(formatConfigError(result.error));
  }
  const env: ValidatedEnv = result.data;
  return {
    port: env.API_PORT,
    databaseUrl: env.DATABASE_URL,
    nodeEnv: env.NODE_ENV,
  };
}

export const config = loadConfig();