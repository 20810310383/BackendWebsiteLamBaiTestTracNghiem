const test = require('node:test');
const assert = require('node:assert/strict');
const { allowOrigin } = require('../src/config/allowedOrigins');

function check(origin) {
  return new Promise(resolve => allowOrigin(origin, (error, allowed) => resolve({ error, allowed })));
}

test('HTTP and Socket.IO share an explicit allowlist with configurable deployment origins', async () => {
  const before = process.env.FRONTEND_ORIGINS;
  try {
    process.env.FRONTEND_ORIGINS = 'https://example.test/, https://other.test';
    assert.equal((await check('https://hoangnghia.vercel.app')).allowed, true);
    assert.equal((await check('https://example.test')).allowed, true);
    assert.equal((await check(undefined)).allowed, true);
    assert.ok((await check('https://untrusted.example')).error);
  } finally {
    if (before === undefined) delete process.env.FRONTEND_ORIGINS;
    else process.env.FRONTEND_ORIGINS = before;
  }
});
