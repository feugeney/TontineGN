import { createApplication } from "@specific-dev/framework";
import * as schema from './db/schema/schema.js';
import * as authSchema from './db/schema/auth-schema.js';
import { registerOtpRoutes } from './routes/otp.js';

// Merge schemas for full database type support
const fullSchema = { ...schema, ...authSchema };

// Create application with schema
export const app = await createApplication(fullSchema);

// Export App type for use in route files
export type App = typeof app;

// Setup authentication with Better Auth
app.withAuth();

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
registerOtpRoutes(app);

await app.run();
app.logger.info('Application running');
