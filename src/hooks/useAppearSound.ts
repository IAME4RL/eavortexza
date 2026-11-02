import { useEffect, useRef, type RefObject } from "react";

/**
 * Plays `src` once when the referenced element first scrolls into view.
 *
 * Browsers block audio until the user has interacted with the page. If playback is
 * refused, the sound is kept pending and plays on the first tap/click/keypress while
 * the element is still on screen.
 */
export function useAppearSound(
  ref: RefObject<HTMLElement | null>,
  src: string,
  enabled: boolean,
  { threshold = 0.4, volume = 0.8 }: { threshold?: number; volume?: number } = {},
) {
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof window === "undefined" || played.current) return;

    let audio: HTMLAudioElement | null = null;
    let visible = false;
    let waiting = false;

    const cleanupGesture = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      waiting = false;
    };

    const tryPlay = () => {
      if (played.current) return;
      audio ??= Object.assign(new Audio(src), { volume, preload: "auto" });
      audio.play().then(
        () => {
          played.current = true;
          cleanupGesture();
          observer?.disconnect();
        },
        () => {
          // Autoplay blocked: wait for the first user gesture.
          if (!waiting) {
            waiting = true;
            window.addEventListener("pointerdown", onGesture);
            window.addEventListener("keydown", onGesture);
          }
        },
      );
    };

    function onGesture() {
      if (visible) tryPlay();
    }

    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          visible = !!entry?.isIntersecting;
          if (visible) tryPlay();
        },
        { threshold },
      );
      observer.observe(el);
    } else {
      visible = true;
      tryPlay();
    }

    return () => {
      observer?.disconnect();
      cleanupGesture();
      audio?.pause();
    };
  }, [ref, src, enabled, threshold, volume]);
}
