import { motion, AnimatePresence } from "framer-motion";
import { Asterisk } from "lucide-react";

interface LoadingScreenProps {
    isVisible: boolean;
}

export function LoadingScreen({ isVisible }: LoadingScreenProps) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="fixed inset-0 z-[100] bg-white flex flex-col"
                >
                    {/* Logo container matching AppHeader layout coordinates */}
                    <div className="absolute top-[12px] left-[16px] flex items-center -space-x-3">
                        <Asterisk
                            className="text-blue-600 animate-turbo-spin"
                            width={32}
                            height={32}
                            strokeWidth={3}
                        />
                        <Asterisk
                            className="text-blue-600"
                            width={32}
                            height={32}
                            strokeWidth={3}
                        />
                    </div>

                    {/* Center message (optional, user said "white page", so we keep it minimal) */}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
