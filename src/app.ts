import express from 'express';

import healthRoutes from './routes/health.routes';

const app = express();

app.use(express.json());

// rotas
app.use('/health', healthRoutes);

export default app;
