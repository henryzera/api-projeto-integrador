import 'dotenv/config';

import app from './app';
import { connectMongo } from './database/mongo';

const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectMongo();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('MongoDB connected');
  });
}

startServer().catch((error) => {
  console.error('Failed to start server');
  console.error(error);
  process.exit(1);
});
