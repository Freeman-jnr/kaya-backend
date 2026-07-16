import request from 'supertest';
import { createApp } from '../src/app';

test('health endpoint responds successfully', async () => {
  const app = createApp();
  const response = await request(app).get('/health');

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
});

test('timeline endpoint requires authentication', async () => {
  const app = createApp();
  const response = await request(app).get('/api/v1/timeline');

  expect(response.status).toBe(401);
});

test('search endpoint requires authentication', async () => {
  const app = createApp();
  const response = await request(app).get('/api/v1/search?q=who%20owes%20me');

  expect(response.status).toBe(401);
});
