export function website(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.hostname : null;
  } catch { return null; }
}

export function localProxy(port) {
  if (!/^\d+$/.test(String(port)) || +port < 1 || +port > 65535) {
    throw new Error("端口应是 1 到 65535 之间的数字，请查看 Clash 的混合端口或 HTTP 端口。");
  }
  return { mode: "fixed_servers", rules: { singleProxy: { scheme: "http", host: "127.0.0.1", port: +port } } };
}

export function withSites(base, sites) {
  if (base?.mode !== "fixed_servers" || !base.rules) throw new Error("请先连接 Clash。");
  const value = structuredClone(base);
  value.rules.bypassList = [...new Set([...(value.rules.bypassList || []), ...sites])];
  return value;
}
