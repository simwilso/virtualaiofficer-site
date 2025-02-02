// __tests__/app.test.js
import request from 'supertest';
import express from 'express';
import dotenv from 'dotenv';

// Load environment variables (if needed for tests)
dotenv.config();

// Import your app (make sure your app.js exports the Express app)
import app from '../app.js'; // Adjust the path if necessary

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
