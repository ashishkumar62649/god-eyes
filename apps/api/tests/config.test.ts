import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/lib/config.js';

const REQUIRED_ENV_NAMES = ['API_PORT', 'DATABASE_URL', 'NODE_ENV'] as const;

describe('API config validation', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = {};
    for (const name of REQUIRED_ENV_NAMES) {
      originalEnv[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of REQUIRED_ENV_NAMES) {
      if (originalEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalEnv[name];
      }
    }
  });

  it('returns valid config with documented defaults when no env vars are set', () => {
    const cfg = loadConfig();
    expect(cfg.port).toBe(4000);
    expect(cfg.databaseUrl).toBe(
      'postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev',
    );
    expect(cfg.nodeEnv).toBe('development');
  });

  it('uses provided API_PORT when it is a valid port number', () => {
    process.env.API_PORT = '5050';
    const cfg = loadConfig();
    expect(cfg.port).toBe(5050);
  });

  it('accepts the maximum valid port (65535)', () => {
    process.env.API_PORT = '65535';
    const cfg = loadConfig();
    expect(cfg.port).toBe(65535);
  });

  it('accepts the minimum valid port (1)', () => {
    process.env.API_PORT = '1';
    const cfg = loadConfig();
    expect(cfg.port).toBe(1);
  });

  it('falls back to default when API_PORT is an empty string', () => {
    process.env.API_PORT = '';
    const cfg = loadConfig();
    expect(cfg.port).toBe(4000);
  });

  it('throws a clear error when API_PORT is not a number', () => {
    process.env.API_PORT = 'not-a-number';
    expect(() => loadConfig()).toThrow(/API_PORT/);
  });

  it('throws a clear error when API_PORT has a decimal', () => {
    process.env.API_PORT = '4000.5';
    expect(() => loadConfig()).toThrow(/API_PORT/);
  });

  it('throws a clear error when API_PORT is below the valid range', () => {
    process.env.API_PORT = '0';
    expect(() => loadConfig()).toThrow(/API_PORT/);
  });

  it('throws a clear error when API_PORT is above the valid range', () => {
    process.env.API_PORT = '99999';
    expect(() => loadConfig()).toThrow(/API_PORT/);
  });

  it('uses provided DATABASE_URL when it is a valid URL', () => {
    process.env.DATABASE_URL = 'postgresql://tester:secret@db.local:5432/testdb';
    const cfg = loadConfig();
    expect(cfg.databaseUrl).toBe(
      'postgresql://tester:secret@db.local:5432/testdb',
    );
  });

  it('falls back to default when DATABASE_URL is an empty string', () => {
    process.env.DATABASE_URL = '';
    const cfg = loadConfig();
    expect(cfg.databaseUrl).toBe(
      'postgresql://god_eyes:god_eyes_dev_password@localhost:5432/god_eyes_dev',
    );
  });

  it('throws a clear error when DATABASE_URL is not a valid URL', () => {
    process.env.DATABASE_URL = 'not a url';
    expect(() => loadConfig()).toThrow(/DATABASE_URL/);
  });

  it('throws a clear error when DATABASE_URL contains spaces', () => {
    process.env.DATABASE_URL = 'http://broken url with spaces';
    expect(() => loadConfig()).toThrow(/DATABASE_URL/);
  });

  it('throws a clear error when DATABASE_URL has only garbage characters', () => {
    process.env.DATABASE_URL = '!!!not a url!!!';
    expect(() => loadConfig()).toThrow(/DATABASE_URL/);
  });

  it('does not leak DATABASE_URL credentials in any error message', () => {
    process.env.DATABASE_URL = 'postgres://tester:supersecret@host with spaces';
    process.env.API_PORT = 'not-a-number';
    let err: Error | undefined;
    try {
      loadConfig();
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeDefined();
    expect(err!.message).not.toContain('supersecret');
    expect(err!.message).not.toContain('tester:');
    expect(err!.message).toContain('API_PORT');
    expect(err!.message).toContain('DATABASE_URL');
    expect(err!.message).toContain('[REDACTED');
  });

  it('uses provided NODE_ENV when it is one of the allowed values', () => {
    process.env.NODE_ENV = 'production';
    const cfg = loadConfig();
    expect(cfg.nodeEnv).toBe('production');
  });

  it('accepts NODE_ENV=test', () => {
    process.env.NODE_ENV = 'test';
    const cfg = loadConfig();
    expect(cfg.nodeEnv).toBe('test');
  });

  it('accepts NODE_ENV=development', () => {
    process.env.NODE_ENV = 'development';
    const cfg = loadConfig();
    expect(cfg.nodeEnv).toBe('development');
  });

  it('falls back to default when NODE_ENV is an empty string', () => {
    process.env.NODE_ENV = '';
    const cfg = loadConfig();
    expect(cfg.nodeEnv).toBe('development');
  });

  it('throws a clear error when NODE_ENV is not in the allowed list', () => {
    process.env.NODE_ENV = 'staging';
    expect(() => loadConfig()).toThrow(/NODE_ENV/);
  });

  it('lists all three variable names in a single error when multiple are invalid', () => {
    process.env.API_PORT = 'not-a-number';
    process.env.DATABASE_URL = 'not-a-url';
    process.env.NODE_ENV = 'staging';
    let err: Error | undefined;
    try {
      loadConfig();
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeDefined();
    expect(err!.message).toContain('API_PORT');
    expect(err!.message).toContain('DATABASE_URL');
    expect(err!.message).toContain('NODE_ENV');
  });
});