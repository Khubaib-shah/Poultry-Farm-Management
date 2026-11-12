import express from 'express';
import { apiRouter } from '../src/server/api.ts';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
