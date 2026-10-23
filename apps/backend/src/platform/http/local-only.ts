import type { NextFunction, Request, Response } from "express";
import { isHomeNetworkRequest } from "@/platform/http/home-network";

/** Tavus posts conversation events here through the public tunnel. */
const PUBLIC_API_PATHS = new Set(["/tavus/webhook"]);

/** The web app's API answers only on this computer and the home network. The tunnel carries /mcp and OAuth, which have their own sign-in. */
export function localOnly(req: Request, res: Response, next: NextFunction) {
  if (isHomeNetworkRequest(req) || PUBLIC_API_PATHS.has(req.path)) return next();
  res.status(403).json({ statusCode: 403, message: "Kanso's app can only be used at home, on the same network as the computer running it.", error: "Forbidden" });
}
