import { Request, Response, NextFunction } from 'express';
import { ListQueueUseCase } from '../../use-cases/executions/ListQueueUseCase';
import { GetExecutionUseCase } from '../../use-cases/executions/GetExecutionUseCase';
import { StartStageUseCase } from '../../use-cases/executions/StartStageUseCase';
import { FinishStageUseCase } from '../../use-cases/executions/FinishStageUseCase';
import { UpdateTaskUseCase } from '../../use-cases/executions/UpdateTaskUseCase';
import { ExecutionPresenter } from '../presenters/ExecutionPresenter';

export class ExecutionController {
  constructor(
    private readonly listQueue: ListQueueUseCase,
    private readonly getExecution: GetExecutionUseCase,
    private readonly startStage: StartStageUseCase,
    private readonly finishStage: FinishStageUseCase,
    private readonly updateTask: UpdateTaskUseCase,
  ) {}

  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, body } = ExecutionPresenter.list(await this.listQueue.execute());
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, body } = ExecutionPresenter.ok(await this.getExecution.execute(req.params.serviceOrderId));
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, body } = ExecutionPresenter.ok(await this.startStage.execute(req.params.serviceOrderId));
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async finish(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, body } = ExecutionPresenter.ok(await this.finishStage.execute(req.params.serviceOrderId));
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async updateTaskStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const execution = await this.updateTask.execute({
        serviceOrderId: req.params.serviceOrderId,
        serviceId: req.params.serviceId,
        status: req.body?.status,
      });
      const { status, body } = ExecutionPresenter.ok(execution);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }
}
