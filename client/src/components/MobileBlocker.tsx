import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

export function MobileBlocker() {
    const [isBlocked, setIsBlocked] = useState(false);

    // Spring-smoothed rotation values for premium feel
    const rotateX = useSpring(0, { stiffness: 60, damping: 20 });
    const rotateY = useSpring(0, { stiffness: 60, damping: 20 });

    useEffect(() => {
        const checkDevice = () => {
            const ua = navigator.userAgent;
            const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
            const isIPad = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || /iPad/.test(ua);

            // For testing: allow manual bypass via URL or if on localhost
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const hasMobileBypass = new URLSearchParams(window.location.search).get('mobile') === 'true';

            // If we are on mobile/iPad AND not in bypass mode, we block
            setIsBlocked((isMobileUA || isIPad) && !hasMobileBypass);
        };

        const handleOrientation = (e: DeviceOrientationEvent) => {
            if (e.beta !== null && e.gamma !== null) {
                // Beta is tilt front-to-back (-180 to 180)
                // Gamma is tilt left-to-right (-90 to 90)
                // We normalize for a subtle effect centered around the usual holding angle
                const y = Math.max(Math.min(e.gamma / 1.5, 20), -20);
                const x = Math.max(Math.min((e.beta - 45) / 1.5, 20), -20);
                rotateX.set(-x);
                rotateY.set(y);
            }
        };

        checkDevice();

        if (window.DeviceOrientationEvent) {
            // Request permission for iOS 13+ devices if needed (usually handled by browser prompt)
            window.addEventListener("deviceorientation", handleOrientation);
        }

        return () => {
            window.removeEventListener("deviceorientation", handleOrientation);
        };
    }, [rotateX, rotateY]);

    if (!isBlocked) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-[#001030] flex items-center justify-center overflow-hidden touch-none select-none">
            {/* Ambient Background Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#0044cc_0%,_#001030_100%)] opacity-40" />

            {/* Animated Light Source */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-400/10 blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[100px]" />

            <motion.div
                style={{ rotateX, rotateY, perspective: 1200 }}
                className="relative z-10 w-full max-w-[min(88vw,480px)] aspect-square"
            >
                {/* Board Container with Glass Effect */}
                <div className="w-full h-full relative rounded-2xl overflow-hidden border border-white/20 backdrop-blur-2xl bg-white/[0.03] shadow-[0_40px_100px_rgba(0,0,0,0.6),inset_0_0_40px_rgba(255,255,255,0.05)]">

                    {/* Inner depth layer for "thick glass" look */}
                    <div className="absolute inset-[1px] rounded-[15px] border border-white/10 pointer-events-none" />

                    {/* Chess Grid */}
                    <div className="w-full h-full grid grid-cols-8 grid-rows-8 p-[6px]">
                        {Array.from({ length: 64 }).map((_, i) => {
                            const row = Math.floor(i / 8);
                            const col = i % 8;
                            const isWhite = (row + col) % 2 === 0;
                            return (
                                <div
                                    key={i}
                                    className={`w-full h-full transition-all duration-700 ${isWhite
                                            ? 'bg-white/[0.06] hover:bg-white/[0.12]'
                                            : 'bg-black/[0.12] hover:bg-black/[0.18]'
                                        }`}
                                />
                            );
                        })}
                    </div>

                    {/* Surface specular/gloss highlight */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.12] via-transparent to-transparent pointer-events-none" />
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.05)_0%,_rgba(255,255,255,0)_50%)] pointer-events-none" />
                </div>
            </motion.div>
        </div>
    );
}
