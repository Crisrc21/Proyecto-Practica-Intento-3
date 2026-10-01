import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { isModifiedNavigation, navigateTo } from "@/app/navigation";

type AppLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
};

export function AppLink({ href, children, onClick, target, ...props }: AppLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (event.defaultPrevented || target === "_blank" || isModifiedNavigation(event)) {
      return;
    }

    event.preventDefault();
    navigateTo(href);
  }

  return (
    <a href={href} target={target} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
