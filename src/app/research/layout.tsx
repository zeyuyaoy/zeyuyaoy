import SiteFooter from "@/app/components/research/SiteFooter";
import "./research.css";

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="research-scope">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="site-body">{children}</div>
      <SiteFooter />
    </div>
  );
}
