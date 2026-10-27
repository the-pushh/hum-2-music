import { describe, expect, it } from "vitest";
import { isPublicAddress } from "./publicAddress";

describe("isPublicAddress", () => {
  it.each(["93.184.215.14", "142.250.80.46", "2606:4700:4700::1111", "2a00:1450:4009:81f::200e"])("allows public address %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.20",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fe80::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
    "::ffff:192.168.0.1",
    "not an ip",
  ])("refuses private, local or reserved address %s", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
});
