const { test } = require('node:test');
const assert = require('node:assert/strict');
const { oauthCallback } = require('./oauth-callback');

test('only forwards callback fields to the configured app origin', () => {
  const result = new URL(oauthCallback('enhanced-todoist://oauth/callback?code=abc&state=desktop_123&extra=secret', 'https://example.test/'));
  assert.equal(result.origin, 'https://example.test');
  assert.equal(result.searchParams.get('code'), 'abc');
  assert.equal(result.searchParams.get('state'), 'desktop_123');
  assert.equal(result.searchParams.has('extra'), false);
});
test('rejects foreign schemes, destinations and malformed state', () => {
  for (const raw of ['https://oauth/callback?state=desktop_a&code=x', 'enhanced-todoist://evil/callback?state=desktop_a&code=x', 'enhanced-todoist://oauth/callback?state=wrong&code=x', 'enhanced-todoist://oauth/callback?state=desktop_a']) {
    assert.equal(oauthCallback(raw, 'https://example.test/'), null);
  }
});
