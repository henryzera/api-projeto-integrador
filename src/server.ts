import app from './app';
import { env } from './config/env';
import { connectMongo } from './database/mongo';
import { ensureUserIndexes } from './repositories/user.repository';

async function startServer() {
  await connectMongo();
  await ensureUserIndexes();

  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
    console.log('MongoDB connected');
  });
}

startServer().catch((error) => {
  console.error('Failed to start server');
  console.error(error);
  process.exit(1);
});
