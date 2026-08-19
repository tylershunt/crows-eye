import { useEffect, useRef, useState } from "react";

/**
 * Supplies a native tooltip for text that is visually truncated.
 *
 * Attach `ref` to the element rendering `text`; `title` is `text` while the
 * element is too narrow to show it in full, and `undefined` otherwise, so a
 * fully visible string never gets a tooltip that merely repeats it.
 */
export function useOverflowTitle<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => setOverflowing(element.scrollWidth > element.clientWidth);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return { ref, title: overflowing ? text : undefined };
}
