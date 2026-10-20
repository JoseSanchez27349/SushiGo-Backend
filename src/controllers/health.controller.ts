import { Request, Response, NextFunction } from 'express';
import { HealthService } from '../services/health.service';

export class HealthController {
  private healthService: HealthService;

  constructor() {
    this.healthService = new HealthService();
  }

  public getHealth = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const status = this.healthService.getSystemStatus();
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  };
}