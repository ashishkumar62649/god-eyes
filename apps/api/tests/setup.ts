import { vi } from 'vitest';

// Global mock for database availability check
// Applied before any test files are loaded
vi.mock('../src/lib/db.js', () => ({
  checkDatabaseStatus: vi.fn().mockResolvedValue({
    status: 'connected',
    latencyMs: 10,
    message: null,
  }),
  query: vi.fn(),
  closePool: vi.fn(),
}));
