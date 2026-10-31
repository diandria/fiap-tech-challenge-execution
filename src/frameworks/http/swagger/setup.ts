import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';
import path from 'path';

// __dirname is src/frameworks/http/swagger in development and the dist
// equivalent in production; both reach the route files the same way.
const routesGlob = path.join(__dirname, '../routes/*.{ts,js}');

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Execution Service',
      version: '1.0.0',
      description: `Execution queue of the car repair shop: diagnosis and repair of each service order.

Orders enter the queue when the OS Service asks for a diagnosis and, after payment, for the repair. Mechanics start and finish the current stage of an order and record the progress of each service; every step is reported back to the OS Service through the saga queues.

## Authentication

Staff token issued at \`POST /auth/login\` on the OS Service, validated here with the same signing secret.`,
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Staff token, issued by POST /auth/login on the OS Service.',
        },
      },
    },
  },
  apis: [routesGlob],
};

export function buildSwaggerSpec(): object {
  return swaggerJsdoc(options) as object;
}

export function setupSwagger(app: Application): void {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(buildSwaggerSpec()));
}
