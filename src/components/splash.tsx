import { HeartPulse } from "lucide-react";

/**
 * Decides, before the page is painted, whether to show the splash: once per browser session, never inside the patient's-phone
 * frame, never to browser automation (tests and screenshots), and never to people who asked their device for less motion.
 * Adding ?splash=1 to the address shows it anyway, for screenshots and demos.
 */
export const splashScript = `try{var d=document.documentElement;if(/[?&]splash=1/.test(location.search)||(!sessionStorage.getItem("l2c-splash")&&window.self===window.top&&!navigator.webdriver&&!matchMedia("(prefers-reduced-motion: reduce)").matches)){d.dataset.splash="on";sessionStorage.setItem("l2c-splash","1")}}catch(e){}`;

/**
 * A one-second opening screen: the logo on a soft gradient, one heartbeat, then it fades away. It is decoration only, so it
 * never takes clicks or focus, and screen readers skip it.
 */
export function Splash() {
  return (
    <div className="splash mesh-bg pointer-events-none fixed inset-0 z-50 place-items-center" aria-hidden="true">
      <div className="splash-mark flex flex-col items-center gap-4">
        <span className="grid size-20 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-xl shadow-primary/30">
          <HeartPulse className="splash-beat size-11" strokeWidth={2.2} />
        </span>
        <span className="font-heading text-3xl font-extrabold tracking-tight text-foreground">Liv2care</span>
        <span className="text-sm font-semibold text-muted-foreground">Closing the loop on liver care</span>
      </div>
    </div>
  );
}
