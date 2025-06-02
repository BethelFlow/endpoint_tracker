import express, { Express, Request, Response } from 'express';
import { startCallingEndpoints } from './endpointCaller';
import { getStats, Stats } from './tracker';

const app: Express = express();
const port: number = 3000;

startCallingEndpoints();

app.get('/rate_tracker/stats', (req: Request, res: Response) => {
  res.json(getStats());
});

app.listen(port, () => {
  console.log(`Endpoint tracker running at http://localhost:${port}`);
});