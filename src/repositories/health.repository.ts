export class HealthRepository {
  public checkDatabaseStatus(): { db: string; latencyMs: number } {
    // Aquí más adelante consultaremos la base de datos real
    return {
      db: 'connected',
      latencyMs: 12,
    };
  }
}
