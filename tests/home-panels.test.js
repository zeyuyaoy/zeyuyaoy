import { expect, test } from "bun:test";
import { panelUrl, parseHomePanel } from "../src/lib/home-panels";

test("only supported section names open dialogs", () => {
  for (const name of ["research", "experience", "education"]) {
    expect(parseHomePanel(`?panel=${name}`)).toBe(name);
  }
  expect(parseHomePanel("?panel=music")).toBeNull();
  expect(parseHomePanel("?panel=about")).toBeNull();
  expect(parseHomePanel("?panel=projects")).toBeNull();
  expect(parseHomePanel("?panel=unknown")).toBeNull();
});
test("closing research clears its state while preserving unrelated URL parameters", () => {
  expect(
    panelUrl(
      "https://zeyuyaoy.com/?utm_source=test&panel=research&project=garcia&q=gene&tag=ML&view=timeline#collection-biorsp",
      null,
    ),
  ).toBe("/?utm_source=test");
  expect(panelUrl("https://zeyuyaoy.com/?panel=research&tag=ML#contact", "experience")).toBe(
    "/?panel=experience#contact",
  );
});
test("opening research retains its shareable filters", () => {
  expect(panelUrl("https://zeyuyaoy.com/?utm_source=test&tag=ML", "research")).toBe(
    "/?utm_source=test&tag=ML&panel=research",
  );
});
