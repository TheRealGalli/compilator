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
        <div className="fixed inset-0 z-[9999] bg-[#000a1a] flex items-center justify-center overflow-hidden touch-none select-none">
            {/* Dark Ambient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#0044cc_0%,_#000a1a_100%)] opacity-20" />

            <motion.div
                style={{ rotateX, rotateY, perspective: 1500 }}
                className="relative z-10 w-full max-w-[min(92vw,500px)] aspect-square"
            >
                {/* Board Container with Premium Glass Foundation */}
                <div className="w-full h-full relative rounded-2xl overflow-hidden border border-white/30 backdrop-blur-3xl bg-white/[0.05] shadow-[0_50px_120px_rgba(0,0,0,0.8),inset_0_0_50px_rgba(255,255,255,0.05)]">

                    {/* The Actual Image from the Photo */}
                    <img
                        src="/chess_board.png"
                        alt="Chess Board"
                        className="absolute inset-0 w-full h-full object-cover opacity-90 mix-blend-lighten"
                    />

                    {/* Interactive Overlay Grid (Transparent) */}
                    <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 p-[10%]">
                        {Array.from({ length: 64 }).map((_, i) => {
                            return (
                                <div
                                    key={i}
                                    className="w-full h-full transition-all duration-300 hover:bg-white/5 active:bg-white/10"
                                />
                            );
                        })}
                    </div>

                    {/* Specular surface glare */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.15)_0%,_transparent_60%)] pointer-events-none" />

                    {/* Inner glass thickness edge */}
                    <div className="absolute inset-[2px] rounded-xl border border-white/20 pointer-events-none" />
                </div>
            </motion.div>

            {/* Subtle glow behind the board */}
            <div className="absolute w-[60%] h-[60%] bg-blue-500/10 blur-[150px] -z-1" />
        </div>
    );
}
