import test from "node:test";
import assert from "node:assert/strict";
import { website, localProxy, withSites } from "../core.js";
test("only normal web pages; keep exact subdomains and normalize international names", () => {
  assert.equal(website("https://WWW.Example.com/a?q=1"), "www.example.com");
  assert.equal(website("https://例子.中国/a"), "xn--fsqu00a.xn--fiqs8s");
  assert.equal(website("http://[::1]:8080/"), "[::1]");
  for (const url of [undefined, "bad", "chrome://extensions", "file:///a"]) assert.equal(website(url), null);
});
test("reject malformed ports", () => {
  for (const port of [0, 65536, "7890; DIRECT", "", "1.2", -1]) assert.throws(() => localProxy(port));
  assert.equal(localProxy("7890").rules.singleProxy.port, 7890);
});
test("preserve protocol proxies and original exclusions without mutating baseline", () => {
  const base = { mode: "fixed_servers", rules: { proxyForHttp: { host: "localhost", port: 7890 }, fallbackProxy: { scheme: "socks5", host: "localhost", port: 7891 }, bypassList: ["<local>"] } };
  const result = withSites(base, ["example.com", "example.com"]);
  assert.deepEqual(result.rules.bypassList, ["<local>", "example.com"]);
  assert.deepEqual(base.rules.bypassList, ["<local>"]);
  assert.deepEqual(result.rules.fallbackProxy, base.rules.fallbackProxy);
});
