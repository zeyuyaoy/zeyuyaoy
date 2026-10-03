import "server-only";
import Markdown from "react-markdown";
import ProfileLink from "./ProfileLink";
import styles from "../Profile.module.css";

export default function ProfileMarkdown({
  source,
  introduction = false,
}: {
  source: string;
  introduction?: boolean;
}) {
  return (
    <Markdown
      skipHtml
      allowedElements={["p", "a", "strong", "em", "ul", "ol", "li", "br"]}
      components={{
        a: ({ href, children }) => <ProfileLink href={href}>{children}</ProfileLink>,
        p: ({ node, children }) => (
          <p
            className={
              introduction
                ? node?.position?.start.offset === 0
                  ? styles.lead
                  : styles.text
                : undefined
            }
          >
            {children}
          </p>
        ),
        ul: ({ children }) => <ul className={styles.contentList}>{children}</ul>,
        ol: ({ start, children }) => (
          <ol className={styles.contentList} start={start}>
            {children}
          </ol>
        ),
      }}
    >
      {source}
    </Markdown>
  );
}
