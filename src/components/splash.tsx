import { LiverMark } from "./liver-mark";

/**
 * Decides, before the page is painted, whether to show the splash: only on the home page (staff and patient pages are tools
 * and open straight away), once per browser session, never inside the patient's-phone
 * frame, never to browser automation (tests and screenshots), and never to people who asked their device for less motion.
 * Adding ?splash=1 to the address shows it anyway, for screenshots and demos.
 */
export const splashScript = `try{var d=document.documentElement;if(/[?&]splash=1/.test(location.search)||(location.pathname==="/"&&!sessionStorage.getItem("l2c-splash")&&window.self===window.top&&!navigator.webdriver&&!matchMedia("(prefers-reduced-motion: reduce)").matches)){d.dataset.splash="on";sessionStorage.setItem("l2c-splash","1")}}catch(e){}`;

/**
 * A short (about 0.7 s) opening screen: the logo on a soft gradient, one heartbeat, then it fades away. It is decoration only, so it
 * never takes clicks or focus, and screen readers skip it.
 */
export function Splash() {
  return (
    <div
      className="splash hero-bg pointer-events-none fixed inset-0 z-50 place-items-center"
      aria-hidden="true"
    >
      <div className="splash-mark flex flex-col items-center gap-4">
        <span className="grid size-20 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-xl shadow-primary/30">
          <LiverMark className="splash-beat size-14" />
        </span>
        <span className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
          Liv2care
        </span>
        <span className="text-sm font-semibold text-muted-foreground">
          Closing the loop on liver care
        </span>
      </div>
    </div>
  );
}
