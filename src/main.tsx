import { render } from "preact";
import { QueryClientProvider } from "@tanstack/preact-query";
import { queryClient } from "@/lib/queryClient";
import "./App.css";
import App from "./App";

(function forceMobileFillHeight() {
  const targets = [document.documentElement, document.body] as HTMLElement[];
  const sync = () => {
    const h = (window.visualViewport?.height ?? window.innerHeight) + "px";
    for (const el of targets) {
      if (el && el.style.height !== h) {
        el.style.height = h;
        el.style.minHeight = h;
      }
    }
  };
  sync();
  window.visualViewport?.addEventListener("resize", sync);
  window.addEventListener("resize", sync);
  window.addEventListener("orientationchange", () => setTimeout(sync, 50));
})();

render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
  document.getElementById("root")!,
);
