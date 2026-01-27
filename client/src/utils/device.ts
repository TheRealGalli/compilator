export const checkDeviceSync = () => {
    if (typeof window === "undefined") return false;
    const ua = navigator.userAgent;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isIPad = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || /iPad/.test(ua);
    const hasMobileBypass = new URLSearchParams(window.location.search).get('mobile') === 'true';
    return (isMobileUA || isIPad) && !hasMobileBypass;
};
