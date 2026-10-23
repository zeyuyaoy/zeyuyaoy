const homePanels = ["research", "experience", "education"] as const;
type HomePanel = (typeof homePanels)[number];

export function parseHomePanel(search: string): HomePanel | null {
  const panel = new URLSearchParams(search).get("panel");
  return homePanels.find((value) => value === panel) ?? null;
}

const researchParams = ["project", "q", "tag", "source", "year", "sort", "view"] as const;

export function panelUrl(current: string, panel: HomePanel | null) {
  const url = new URL(current, "https://zeyuyaoy.com");
  if (panel) {
    url.searchParams.set("panel", panel);
  } else {
    url.searchParams.delete("panel");
  }
  if (panel !== "research") {
    researchParams.forEach((key) => url.searchParams.delete(key));
    if (/^#(?:collection-|research-)/.test(url.hash)) {
      url.hash = "";
    }
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
