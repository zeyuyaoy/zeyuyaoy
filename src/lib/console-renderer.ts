export type ConsoleOutput = Pick<Console, "log" | "table">;

const badge =
  "background:#35594b;color:#faf8f3;font-family:monospace;font-weight:bold;padding:4px 8px;border-radius:4px";

export function createConsoleRenderer(output: ConsoleOutput) {
  return {
    text(value: string) {
      output.log("%s", value);
    },
    heading(value: string) {
      output.log(
        "%c%s",
        value.includes("\n") ? `${badge};padding:0;border-radius:0` : badge,
        value,
      );
    },
    table(rows: Record<string, string | number>[]) {
      output.table(rows);
    },
  };
}
