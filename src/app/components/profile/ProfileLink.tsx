import type { ReactNode } from "react";
import styles from "../Profile.module.css";

export default function ProfileLink({ href, children }: { href?: string; children: ReactNode }) {
  const external = href !== undefined && /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      className={styles.link}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
}
