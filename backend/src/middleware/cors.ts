import cors from 'cors';

export const corsMiddleware = cors({
  origin: true, // reflect request origin (allow all in dev)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Desktop-Token'],
});
