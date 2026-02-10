import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

const LIMITS = {
    free: { compilation: 10, chat: 50 },
    pro: { compilation: 100, chat: 500 },
    enterprise: { compilation: 10000, chat: 10000 }
};

export const checkLimit = (resourceType: 'compilation' | 'chat') => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // 1. Auth Check (Critical)
        // Guest mode for Analyzer: Allow 'chat' without authentication
        if (resourceType !== 'chat' && (!req.isAuthenticated() || !req.user)) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const user = req.user as any;
        // const plan = (user.planTier || 'free') as keyof typeof LIMITS;

        // --- TEMPORARILY DISABLED: Usage Counting & Limits ---
        // User requested to move counting to a dedicated secondary DB later.
        // Converting to "Auth Only" mode for now.

        // Attach dummy incrementUsage to prevent routes from crashing
        (req as any).incrementUsage = async () => {
            // No-op
        };

        next();
    };
};
