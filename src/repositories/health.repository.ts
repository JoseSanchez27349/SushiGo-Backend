import { db } from '../config/database';

export class HealthRepository {
  public async checkDatabaseStatus(): Promise<{ db: string; latencyMs: number }> {
    const start = Date.now();
    await db.query('SELECT 1');
    const latencyMs = Date.now() - start;

    return {
      db: 'connected',
      latencyMs,
    };
  }
}