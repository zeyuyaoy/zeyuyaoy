const researchPath = "/research";
const archivePath = "/?panel=research";

export function projectPath(slug: string) {
  return `${archivePath}&project=${encodeURIComponent(slug)}`;
}

export function shortPath(slug: string) {
  return `${researchPath}/${encodeURIComponent(slug)}`;
}

export function archiveTagPath(current: string, tag: string) {
  const url = new URL(current, "https://zeyuyaoy.com");
  url.searchParams.set("panel", "research");
  url.searchParams.delete("project");
  if (!url.searchParams.getAll("tag").includes(tag)) {
    url.searchParams.append("tag", tag);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
