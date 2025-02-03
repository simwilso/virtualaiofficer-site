// __tests__/app.test.js
import request from 'supertest';
import { app, server } from '../app.js'; // Adjust the path if necessary

describe('AI Orchestrator Endpoints', () => {
  test('GET / (should return 404)', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(404);
  });

  test('POST /processIssue should return a suggestion', async () => {
    const response = await request(app)
      .post('/processIssue')
      .send({ issue: "The header color is too dull" });
    expect(response.statusCode).toBe(200);
    expect(response.body.suggestion).toBeDefined();
  });
});

// After all tests, close the server so Jest can exit
afterAll(() => {
  server.close();
});

