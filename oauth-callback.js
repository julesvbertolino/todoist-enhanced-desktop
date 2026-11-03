function oauthCallback(raw, appUrl, scheme = 'enhanced-todoist') {
  try {
    const url = new URL(raw);
    if (url.protocol !== `${scheme}:` || url.hostname !== 'oauth' || url.pathname !== '/callback') return null;
    const state = url.searchParams.get('state');
    if (!state || !/^desktop_[A-Za-z0-9_-]+$/.test(state)) return null;
    if (!url.searchParams.get('code') && !url.searchParams.get('error')) return null;
    const target = new URL(appUrl);
    for (const key of ['code', 'error', 'state']) {
      const value = url.searchParams.get(key);
      if (value) target.searchParams.set(key, value);
    }
    return target.href;
  } catch { return null; }
}
module.exports = { oauthCallback };
