import styles from "./Webring.module.css";
import Link from "next/link";

export default function Webring() {
  const name = "zeyuyaoy";
  return (
    <div className={styles.webring}>
      <Link href={`https://webring.bucketfish.me/redirect.html?to=prev&name=${name}`} className={styles.link}>
        ‹ Prev
      </Link>
      <Link href="https://webring.bucketfish.me" className={styles.title}>
        🐠 Bucket Webring
      </Link>
      <Link href={`https://webring.bucketfish.me/redirect.html?to=next&name=${name}`} className={styles.link}>
        › Next
      </Link>
    </div>
  );
}
