// @vitest-environment jsdom
import { expect, it } from "vitest";
import { formatRemoteError } from "./i18n";
import { sampleRow } from "./TableEditor";
import { defaultTableColumns } from "./types";

it("builds the sample row from the default columns of a new table", () => {
  expect(sampleRow((key) => formatRemoteError("zh", key))).toBe('{"名称": "", "内容": ""}');
  for (const language of ["en", "ru"] as const) {
    const t = (source: string) => formatRemoteError(language, source);
    expect(Object.keys(JSON.parse(sampleRow(t)) as object)).toEqual(defaultTableColumns(t));
  }
  expect(sampleRow((source) => formatRemoteError("ru", source))).toBe('{"Название": "", "Содержимое": ""}');
});
