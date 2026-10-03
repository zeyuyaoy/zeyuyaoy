import ProfileMarkdown from "./ProfileMarkdown";
import styles from "../Profile.module.css";

export default function AboutPanel({ markdown }: { markdown: string }) {
  return (
    <div className={styles.stack}>
      <ProfileMarkdown source={markdown} introduction />
    </div>
  );
}
