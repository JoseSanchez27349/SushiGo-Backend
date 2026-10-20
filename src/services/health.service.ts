import 'dotenv/config';
import { HealthRepository } from '../repositories/health.repository';

export class HealthService {
  private healthRepository: HealthRepository;

  constructor() {
    this.healthRepository = new HealthRepository();
  }

  public async getSystemStatus() {
    const dbStatus = await this.healthRepository.checkDatabaseStatus();

    return {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: dbStatus,
    };
  }
}