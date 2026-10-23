import { describe, expect, it } from "vitest";
import { csvCell, neutralizeSpreadsheetFormula } from "@/lib/research/exportCsv";

describe("CSV export safety", () => {
  it.each(["=cmd()", "+SUM(1,2)", " -2+3", "@IMPORTXML(A1)"])(
    "neutralizes formula-like value %s",
    (value) => {
      expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`);
    },
  );

  it("quotes structural CSV characters after neutralization", () => {
    expect(csvCell("hello, world")).toBe('"hello, world"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });
});
