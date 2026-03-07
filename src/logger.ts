import pino from "pino";
import { env } from "@/env";

// Use pino-pretty only outside Vercel/production (devDependency — not installed in prod).
const isDev = env.VERCEL !== "1" && env.NODE_ENV !== "production";

export const logger = isDev
	? pino({
			level: env.LOG_LEVEL,
			transport: { target: "pino-pretty", options: { colorize: true } },
		})
	: pino({ level: env.LOG_LEVEL });
