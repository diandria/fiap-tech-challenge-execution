import { Router } from 'express';
import { ExecutionController } from '../../../adapters/controllers/ExecutionController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

/**
 * Mounted at `/executions`. The same roles that move a service order between
 * diagnosis and repair on the OS Service.
 */
export function executionRoutes(controller: ExecutionController): Router {
  const router = Router();
  const mechanicOrAdmin = [authMiddleware, requireRole('mechanic', 'admin')];

  /**
   * @openapi
   * /executions:
   *   get:
   *     summary: The mechanic's queue (mechanic, admin)
   *     description: Executions in progress first, then the queued ones, each oldest first.
   *     tags: [Executions]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: The queue
   *       401:
   *         description: Missing or invalid token
   *       403:
   *         description: Not a mechanic or admin token
   */
  router.get('/', ...mechanicOrAdmin, (req, res, next) => controller.list(req, res, next));

  /**
   * @openapi
   * /executions/stats/average-task-duration:
   *   get:
   *     summary: Average duration of each service over the finished repairs (attendant, admin)
   *     tags: [Executions]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: One entry per service, with the mean in minutes (one decimal) and how many repairs it covers
   *         content:
   *           application/json:
   *             example: [{ "serviceId": "c0000000-0000-4000-8000-000000000001", "name": "Oil change", "avgMinutes": 42.5, "count": 3 }]
   *       403:
   *         description: Not an attendant or admin token
   */
  // Declared before /:serviceOrderId, which would otherwise take "stats" as an order id.
  router.get('/stats/average-task-duration', authMiddleware, requireRole('attendant', 'admin'), (req, res, next) => controller.averageDuration(req, res, next));

  /**
   * @openapi
   * /executions/{serviceOrderId}:
   *   get:
   *     summary: Execution of a service order (mechanic, admin)
   *     tags: [Executions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceOrderId
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: The execution, with its stage, status and tasks
   *       403:
   *         description: Not a mechanic or admin token
   *       404:
   *         description: The order has no execution
   */
  router.get('/:serviceOrderId', ...mechanicOrAdmin, (req, res, next) => controller.get(req, res, next));

  /**
   * @openapi
   * /executions/{serviceOrderId}/start:
   *   post:
   *     summary: Start the current stage, diagnosis or repair (mechanic, admin)
   *     description: |
   *       The stage comes from the execution, not from the request. Starting a diagnosis tells the
   *       OS Service DiagnosisStarted; starting a repair, RepairStarted.
   *     tags: [Executions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceOrderId
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: The execution, now in progress
   *       400:
   *         description: The execution is not queued
   *       403:
   *         description: Not a mechanic or admin token
   *       404:
   *         description: The order has no execution
   *       409:
   *         description: The execution changed while the request was being handled
   */
  router.post('/:serviceOrderId/start', ...mechanicOrAdmin, (req, res, next) => controller.start(req, res, next));

  /**
   * @openapi
   * /executions/{serviceOrderId}/finish:
   *   post:
   *     summary: Finish the current stage, diagnosis or repair (mechanic, admin)
   *     description: |
   *       Finishing a diagnosis tells the OS Service DiagnosisCompleted, which leads to the budget;
   *       finishing a repair, RepairCompleted.
   *     tags: [Executions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceOrderId
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: The execution, now done
   *       400:
   *         description: The execution is not in progress
   *       403:
   *         description: Not a mechanic or admin token
   *       404:
   *         description: The order has no execution
   *       409:
   *         description: The execution changed while the request was being handled
   */
  router.post('/:serviceOrderId/finish', ...mechanicOrAdmin, (req, res, next) => controller.finish(req, res, next));

  /**
   * @openapi
   * /executions/{serviceOrderId}/tasks/{serviceId}:
   *   patch:
   *     summary: Start or finish one service of the repair (mechanic, admin)
   *     description: |
   *       Only while the repair is in progress. A service starts once and finishes once, after starting.
   *       The times feed the average duration per service.
   *     tags: [Executions]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: serviceOrderId
   *         required: true
   *         schema: { type: string, format: uuid }
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [IN_PROGRESS, COMPLETED]
   *     responses:
   *       200:
   *         description: The execution with the service updated
   *       400:
   *         description: Invalid status, repair not in progress, or service already started or finished
   *       403:
   *         description: Not a mechanic or admin token
   *       404:
   *         description: The order has no execution, or the service is not part of the repair
   */
  router.patch('/:serviceOrderId/tasks/:serviceId', ...mechanicOrAdmin, (req, res, next) => controller.updateTaskStatus(req, res, next));

  return router;
}
