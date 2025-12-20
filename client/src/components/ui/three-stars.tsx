export const ThreeStars = ({ className }: { className?: string }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={className}
        >
            {/* Left star (smaller) */}
            <path
                d="M4 10.5l1.5 1 1-1.5-1-1.5-1.5 1z"
                opacity="0.7"
            />

            {/* Center star (largest) */}
            <path
                d="M12 2l2.5 5 5.5 0.8-4 3.9 0.9 5.3-4.9-2.6-4.9 2.6 0.9-5.3-4-3.9 5.5-0.8z"
            />

            {/* Right star (smaller) */}
            <path
                d="M19 10.5l1.5 1 1-1.5-1-1.5-1.5 1z"
                opacity="0.7"
            />
        </svg>
    );
};
