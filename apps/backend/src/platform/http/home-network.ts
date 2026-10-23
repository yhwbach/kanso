import { BlockList, isIPv4 } from "node:net";
import type { Request } from "express";

const LOOPBACK = new BlockList();
LOOPBACK.addSubnet("127.0.0.0", 8, "ipv4");
LOOPBACK.addAddress("::1", "ipv6");

const HOME_NETWORK = new BlockList();
HOME_NETWORK.addSubnet("10.0.0.0", 8, "ipv4");
HOME_NETWORK.addSubnet("172.16.0.0", 12, "ipv4");
HOME_NETWORK.addSubnet("192.168.0.0", 16, "ipv4");
HOME_NETWORK.addSubnet("169.254.0.0", 16, "ipv4");
HOME_NETWORK.addSubnet("fc00::", 7, "ipv6");
HOME_NETWORK.addSubnet("fe80::", 10, "ipv6");

/** Tunnels such as cloudflared and ngrok connect from loopback too, but they always add a forwarding header. */
function directAddress(req: Request) {
  const forwarded = req.headers["cf-connecting-ip"] ?? req.headers["x-forwarded-for"] ?? req.headers["forwarded"];
  if (forwarded) return null;
  const address = (req.socket.remoteAddress ?? "").replace(/^::ffff:(?=\d+\.)/, "").replace(/%.*$/, "");
  return address ? { address, type: isIPv4(address) ? ("ipv4" as const) : ("ipv6" as const) } : null;
}

/** True for this machine and for devices on the same private network, such as a phone on the home wifi. */
export function isHomeNetworkRequest(req: Request): boolean {
  const ip = directAddress(req);
  return ip !== null && (LOOPBACK.check(ip.address, ip.type) || HOME_NETWORK.check(ip.address, ip.type));
}

/** Whether a browser origin is served from this machine or the home network, so its requests may cross origins. */
export function isHomeNetworkOrigin(origin: string): boolean {
  let host: string;
  try {
    host = new URL(origin).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return false;
  }
  if (host === "localhost" || host.endsWith(".local")) return true;
  const type = isIPv4(host) ? "ipv4" : host.includes(":") ? "ipv6" : null;
  return type !== null && (LOOPBACK.check(host, type) || HOME_NETWORK.check(host, type));
}
