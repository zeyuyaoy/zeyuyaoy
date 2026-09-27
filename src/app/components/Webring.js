import styles from "./Webring.module.css";

export default function Webring() {
  const name = "zeyuyaoy";
  return (
    <nav className={styles.webring} aria-label="Bucket Webring">
      <a
        href={`https://webring.bucketfish.me/redirect.html?to=prev&name=${name}`}
        className={styles.link}
        aria-label="Previous site in Bucket Webring"
      >
        ‹ Prev
      </a>
      <a href="https://webring.bucketfish.me" className={styles.title} aria-label="Bucket Webring">
        <span aria-hidden="true">🐠</span>
        <span className={styles.titleText}>Bucket Webring</span>
      </a>
      <a
        href={`https://webring.bucketfish.me/redirect.html?to=next&name=${name}`}
        className={styles.link}
        aria-label="Next site in Bucket Webring"
      >
        › Next
      </a>
    </nav>
  );
}
