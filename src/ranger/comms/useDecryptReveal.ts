import { useEffect, useState } from "preact/hooks";

const CIPHER_CHARS = "!@#$%&*<>?/\\|~^01".split("");

function randomCipher(length: number): string {
  return Array.from({ length }, () => CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)]).join("");
}

/**
 * Shared encrypt→decrypt scramble animation for a comm message body — one
 * hook so every place that renders a message (radar's log line, personel's
 * chat bubble) plays the identical effect instead of each reimplementing it.
 * Freshly-appended messages (not history hydrated on load — see `animate`,
 * set by the caller) scramble into cipher noise for a beat, then reveal the
 * real text left-to-right.
 */
export function useDecryptReveal(body: string, animate: boolean) {
  const [displayBody, setDisplayBody] = useState(() => (animate ? randomCipher(body.length) : body));
  const [revealed, setRevealed] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    let cancelled = false;

    async function run() {
      for (let i = 0; i < 4; i++) {
        if (cancelled) return;
        setDisplayBody(randomCipher(body.length));
        await new Promise((r) => setTimeout(r, 60));
      }
      for (let revealCount = 0; revealCount <= body.length; revealCount++) {
        if (cancelled) return;
        setDisplayBody(body.slice(0, revealCount) + randomCipher(body.length - revealCount));
        await new Promise((r) => setTimeout(r, 18));
      }
      if (cancelled) return;
      setDisplayBody(body);
      setRevealed(true);
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { displayBody, revealed };
}
