import request from 'supertest';
import Server from '../../src/server';

describe('Server', () => {
  let server: Server;
  let app: any;

  beforeAll(async () => {
    server = new Server();
    app = server.getApp();
  });

  describe('Health Endpoints', () => {
    test('GET /ping should return pong', async () => {
      const response = await request(app)
        .get('/ping')
        .expect(200);
      
      expect(response.text).toBe('pong');
    });

    test('GET /api/health should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect((res) => {
          expect([200, 206, 503]).toContain(res.status);
        });
      
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('metrics');
    });

    test('GET /api/info should return API information', async () => {
      const response = await request(app)
        .get('/api/info')
        .expect(200);
      
      expect(response.body).toHaveProperty('name', 'SukeNyaa');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('description');
    });
  });

  describe('Stremio Addon', () => {
    test('GET /manifest.json should return addon manifest', async () => {
      const response = await request(app)
        .get('/manifest.json')
        .expect(200);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('resources');
      expect(response.body).toHaveProperty('types');
      expect(response.body).toHaveProperty('catalogs');
    });

    test('GET / should return addon information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);
      
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('status', 'online');
    });
  });

  describe('Error Handling', () => {
    test('GET /nonexistent should return 404', async () => {
      const response = await request(app)
        .get('/nonexistent')
        .expect(404);
      
      expect(response.body).toHaveProperty('error', 'Not Found');
    });
  });
});