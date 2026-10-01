import type { MouseEvent } from "react";

export function navigateTo(href: string, options: { scroll?: boolean } = {}) {
  const nextUrl = new URL(href, window.location.origin);
  const currentUrl = new URL(window.location.href);

  if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) {
    return;
  }

  window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
  window.dispatchEvent(new PopStateEvent("popstate"));

  if (options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

export function isModifiedNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}
