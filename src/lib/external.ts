import { openUrl } from "@tauri-apps/plugin-opener";

/** Opens a link in the browser the user is signed in to GitHub with. */
export async function openExternal(url: string): Promise<void> {
  await openUrl(url);
}

/**
 * Routes every link click to the browser for the lifetime of the returned
 * unsubscribe.
 *
 * The dashboard owns the only web view in the app and has no address bar of its
 * own, so a link followed in place would strand the user on a page with no way
 * back.
 */
export function sendLinksToTheBrowser(): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || !(event.target instanceof Element)) return;

    const href = event.target.closest("a")?.href;
    if (!href || !/^https?:/i.test(href)) return;

    event.preventDefault();
    void openExternal(href);
  };

  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}
