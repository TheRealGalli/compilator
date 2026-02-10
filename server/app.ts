import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";
import compression from "compression";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pg from "pg";
const PgStore = pgSession(session);


import { registerRoutes } from "./routes";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Factory function to create and configure the Express app
function createApp() {
  const app = express();
  console.log('[DEBUG SERVER] Creating Express app and configuring middleware...');

  // CORS allowed origins
  const ALLOWED_ORIGINS = [
    'https://therealgalli.github.io',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  // CORS Middleware MUST be the first one
  const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // LOG ALL REQUESTS TO DEBUG
    console.log(`[DEBUG REQUEST] ${req.method} ${req.path} - Origin: ${origin}`);

    // Set Vary: Origin to prevent cache issues
    res.setHeader('Vary', 'Origin');

    // Allow any origin that matches the pattern or is localhost
    if (origin) {
      if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.github.io')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else {
        // Default to a safe fallback instead of nothing
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    } else {
      // Allow curl/postman for testing
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-gmail-tokens, Accept, Origin');

    if (req.method === 'OPTIONS') {
      console.log(`[DEBUG CORS] Handling OPTIONS for ${req.path}`);
      res.status(204).end();
      return;
    }

    // Test endpoint handled directly in middleware to bypass everything else
    if (req.path === '/api/cors-test') {
      res.json({ status: 'ok', cors: 'active', timestamp: new Date().toISOString() });
      return;
    }

    next();
  };

  // Apply CORS middleware globally
  app.use(corsMiddleware);

  // Fallback for Incognito/Cross-domain: Inject session header into cookies if present
  app.use((req, res, next) => {
    const sessionId = req.headers['x-session-id'];
    if (sessionId && typeof sessionId === 'string' && !req.headers.cookie?.includes('csd.sid')) {
      // Re-inject the signed session ID into the cookie header
      // express-session will then pick it up as if it were a standard cookie
      req.headers.cookie = `csd.sid=${sessionId}; ${req.headers.cookie || ''}`;
      console.log(`[DEBUG SESSION] Fallback: Injected x-session-id into cookie header`);
    }
    next();
  });

  // Explicitly handle OPTIONS for all routes (just in case app.use misses it)
  app.options('*', corsMiddleware);

  // Enable gzip compression
  app.use(compression());

  // Trust proxy is required for Cloud Run to handle HTTPS cookies correctly
  app.set('trust proxy', 1);

  // Configure session for OAuth storage
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set, falling back to MemoryStore for session (NOT FOR PRODUCTION)");
  }

  app.use(session({
    store: process.env.DATABASE_URL ? new PgStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true
    }) : undefined,
    secret: 'csd-station-gmail-session-secret',
    resave: false,
    saveUninitialized: false,
    name: 'csd.sid', // Custom cookie name
    cookie: {
      secure: true, // MUST be true for SameSite: none
      sameSite: 'none', // Required for cross-site (GitHub Pages -> Cloud Run)
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Body parsing middleware
  app.use(express.json({
    limit: '250mb',
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: false, limit: '250mb' }));

  // Logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 2000) {
          logLine = logLine.slice(0, 1999) + "…";
        }

        log(logLine);
      }
    });

    next();
  });

  return app;
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Export app for backward compatibility if needed (though runApp uses local instance now)
export const app = createApp();

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  // Use the exported app instance which is already configured
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Set CORS headers for error responses too
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    console.error(`[SYSTEM ERROR] ${status} - ${message}`, err);
    res.status(status).json({ message, error: message });
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5001', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
}
