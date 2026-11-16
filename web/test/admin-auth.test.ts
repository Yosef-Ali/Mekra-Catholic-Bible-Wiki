// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { needsAdmin, isAdminRequest, adminConfigured, guardWrites } from '../server/auth';

const req = (authorization?: string) => ({ headers: { authorization } }) as any;

function run(method: string, url: string, authorization?: string) {
  const out: { status?: number; body?: any; passed: boolean } = { passed: false };
  const res: any = {
    status(code: number) { out.status = code; return res; },
    json(body: any) { out.body = body; return res; },
  };
  guardWrites({ method, originalUrl: url, url, headers: { authorization } } as any, res, () => { out.passed = true; });
  return out;
}

describe('needsAdmin — which requests are protected', () => {
  it('leaves reading open', () => {
    expect(needsAdmin('GET', '/api/books')).toBe(false);
    expect(needsAdmin('GET', '/api/chapters/195/1')).toBe(false);
    expect(needsAdmin('GET', '/api/wiki')).toBe(false);
    expect(needsAdmin('GET', '/api/readings/today')).toBe(false);
    expect(needsAdmin('GET', '/api/health')).toBe(false);
  });

  it('protects every write to Scripture and readings', () => {
    expect(needsAdmin('PUT', '/api/chapters/195/1')).toBe(true);
    expect(needsAdmin('PUT', '/api/readings/2026-12-25')).toBe(true);
    expect(needsAdmin('DELETE', '/api/chapters/195/1')).toBe(true);
    expect(needsAdmin('PATCH', '/api/books/1')).toBe(true);
  });

  it('protects the users routes, including the list (private data)', () => {
    expect(needsAdmin('GET', '/api/users')).toBe(true);
    expect(needsAdmin('POST', '/api/users/sync')).toBe(true);
    expect(needsAdmin('PUT', '/api/users/3/role')).toBe(true);
  });

  it('keeps the read-only POSTs the apps depend on open', () => {
    for (const p of ['/api/ai/tts', '/api/ai/chat-stream', '/api/ai/generate', '/api/ai/daily-reflection', '/api/chapters/search']) {
      expect(needsAdmin('POST', p)).toBe(false);
      expect(needsAdmin('POST', p + '/')).toBe(false);
    }
  });

  it('is default-deny: a POST route nobody listed is protected', () => {
    expect(needsAdmin('POST', '/api/some-new-route')).toBe(true);
    expect(needsAdmin('POST', '/api/admin/verify')).toBe(true);
  });
});

describe('token check', () => {
  const saved = process.env.ADMIN_TOKEN;
  beforeEach(() => { process.env.ADMIN_TOKEN = 'correct horse battery'; });
  afterEach(() => { if (saved === undefined) delete process.env.ADMIN_TOKEN; else process.env.ADMIN_TOKEN = saved; });

  it('accepts the right token and nothing else', () => {
    expect(isAdminRequest(req('Bearer correct horse battery'))).toBe(true);
    expect(isAdminRequest(req('bearer correct horse battery'))).toBe(true);
    expect(isAdminRequest(req('Bearer wrong'))).toBe(false);
    expect(isAdminRequest(req('correct horse battery'))).toBe(false);
    expect(isAdminRequest(req(undefined))).toBe(false);
    expect(isAdminRequest(req('Bearer '))).toBe(false);
  });

  it('lets a write through only with the token', () => {
    expect(run('PUT', '/api/chapters/195/1').status).toBe(401);
    expect(run('PUT', '/api/chapters/195/1', 'Bearer nope').status).toBe(401);
    expect(run('PUT', '/api/chapters/195/1?x=1', 'Bearer correct horse battery').passed).toBe(true);
    expect(run('GET', '/api/chapters/195/1').passed).toBe(true);
  });

  it('fails closed when no token is configured', () => {
    delete process.env.ADMIN_TOKEN;
    expect(adminConfigured()).toBe(false);
    const out = run('PUT', '/api/chapters/195/1', 'Bearer anything');
    expect(out.passed).toBe(false);
    expect(out.status).toBe(503);
    expect(out.body.code).toBe('ADMIN_NOT_CONFIGURED');
    // an empty or whitespace token is not a token
    process.env.ADMIN_TOKEN = '   ';
    expect(run('PUT', '/api/chapters/195/1', 'Bearer    ').passed).toBe(false);
  });
});
