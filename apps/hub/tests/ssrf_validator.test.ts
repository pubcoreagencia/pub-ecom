import { describe, it, expect } from "vitest";
import { isAllowedTargetUrl, validateTargetUrl } from "../src/lib/ingestion/security/urlValidator";

describe("SSRF Protection & Target URL Validator", () => {
  describe("Blocked Malicious and Internal Targets", () => {
    it("rejects loopback IP 127.0.0.1", () => {
      expect(isAllowedTargetUrl("http://127.0.0.1")).toBe(false);
      expect(isAllowedTargetUrl("http://127.0.0.1:8080")).toBe(false);
    });

    it("rejects localhost hostname", () => {
      expect(isAllowedTargetUrl("http://localhost")).toBe(false);
      expect(isAllowedTargetUrl("http://localhost:3000")).toBe(false);
    });

    it("rejects cloud instance metadata IP 169.254.169.254", () => {
      expect(isAllowedTargetUrl("http://169.254.169.254")).toBe(false);
      expect(isAllowedTargetUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    });

    it("rejects RFC1918 Class A private IP 10.0.0.1", () => {
      expect(isAllowedTargetUrl("http://10.0.0.1")).toBe(false);
      expect(isAllowedTargetUrl("http://10.1.2.3/api")).toBe(false);
    });

    it("rejects RFC1918 Class C private IP 192.168.1.1", () => {
      expect(isAllowedTargetUrl("http://192.168.1.1")).toBe(false);
      expect(isAllowedTargetUrl("http://192.168.0.100")).toBe(false);
    });

    it("rejects RFC1918 Class B private IP 172.16.0.1", () => {
      expect(isAllowedTargetUrl("http://172.16.0.1")).toBe(false);
      expect(isAllowedTargetUrl("http://172.31.255.254")).toBe(false);
    });

    it("rejects non-HTTP protocols (file://, javascript:, ftp:, data:)", () => {
      expect(isAllowedTargetUrl("file:///etc/passwd")).toBe(false);
      expect(isAllowedTargetUrl("javascript:alert(1)")).toBe(false);
      expect(isAllowedTargetUrl("ftp://example.com/file")).toBe(false);
      expect(isAllowedTargetUrl("data:text/html,<html></html>")).toBe(false);
    });

    it("rejects arbitrary unauthorized third-party external domains", () => {
      expect(isAllowedTargetUrl("https://evil.com")).toBe(false);
      expect(isAllowedTargetUrl("https://google.com")).toBe(false);
      expect(isAllowedTargetUrl("https://attacker.shopee.evil.com")).toBe(false);
    });

    it("throws Error when validateTargetUrl is called on blocked target", () => {
      expect(() => validateTargetUrl("http://169.254.169.254")).toThrow(/SSRF Block/);
      expect(() => validateTargetUrl("file:///etc/passwd")).toThrow(/SSRF Block/);
    });
  });

  describe("Allowed Legitimate Targets", () => {
    it("accepts legitimate Shopee Brasil store URLs", () => {
      expect(isAllowedTargetUrl("https://shopee.com.br/shop/918273645")).toBe(true);
      expect(isAllowedTargetUrl("https://shopee.com.br/product/12345/67890")).toBe(true);
      expect(isAllowedTargetUrl("https://cf.shopee.com.br/file/abcd1234efgh")).toBe(true);
    });

    it("accepts legitimate Shopee regional domains", () => {
      expect(isAllowedTargetUrl("https://shopee.com/shop/123")).toBe(true);
      expect(isAllowedTargetUrl("https://shopee.com.my/shop/123")).toBe(true);
      expect(isAllowedTargetUrl("https://shopee.sg/shop/123")).toBe(true);
    });

    it("validateTargetUrl executes without throwing on legitimate target", () => {
      expect(() => validateTargetUrl("https://shopee.com.br/shop/918273645")).not.toThrow();
    });
  });
});
