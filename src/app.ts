import express from 'express';

import contratacoesRoutes from './routes/contratacoes.routes';
import healthRoutes from './routes/health.routes';

const app = express();

app.use(express.json());

// rotas
app.use('/health', healthRoutes);
app.use('/contratacoes', contratacoesRoutes);

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);

  return res.status(500).json({
    message: 'Internal server error'
  });
});

export default app;
