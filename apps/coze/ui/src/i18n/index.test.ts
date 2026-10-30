import { afterEach, expect, it } from "vitest";
import {
  displayText, formatRemoteError, formatDate, formatDateTime, formatList, getLanguage, interpolate, msg, setLanguage, t, translate, verbatim,
} from "./index";

afterEach(() => setLanguage("zh"));

it("starts in the zh-CN test locale", () => {
  expect(getLanguage()).toBe("zh");
});

it("returns the Chinese source for zh and for missing keys", () => {
  expect(translate("zh", "coze.core.save")).toBe("保存");
  expect(translate("en", "coze.core.save")).toBe("Save");
  expect(translate("ru", "coze.core.save")).toBe("Сохранить");
  expect(displayText("没有这条翻译", {}, "en")).toBe("没有这条翻译");
  expect(displayText("toString", {}, "en")).toBe("toString");
});

it("interpolates once and only supplied values", () => {
  const key = "coze.core.draftVersionPublishedVersion";
  expect(translate("zh", key, { revision: 3, published: 2 })).toBe("当前草稿版本：3　已发布版本：2");
  expect(translate("en", key, { revision: 3, published: "{revision}" }))
    .toBe("Draft version: 3 · Published version: {revision}");
  expect(interpolate("{a} {b}", { a: "$&" })).toBe("$& {b}");
});

it("translates runtime messages with an embedded reason", () => {
  expect(formatRemoteError("en", "暂时无法导入此节点：59。")).toBe("This node can't be imported yet: 59.");
  expect(formatRemoteError("ru", "暂时无法导入此节点：59。")).toBe("Сейчас не удаётся импортировать этот узел: 59.");
  expect(formatRemoteError("zh", "暂时无法导入此节点：59。")).toBe("暂时无法导入此节点：59。");
});

it("follows setLanguage in t() and the formatters", () => {
  expect(t("coze.core.stopCoze")).toBe("停止 Coze");
  expect(formatList(["a", "b", "c"])).toBe("a、b、c");
  setLanguage("en");
  expect(t("coze.core.stopCoze")).toBe("Stop Coze");
  expect(formatList(["a", "b", "c"])).toBe("a, b, and c");
  expect(formatDate("2026-10-21T10:05:03Z", { timeZone: "UTC" })).toBe("10/21/2026");
  setLanguage("ru");
  expect(formatList(["a", "b", "c"], "disjunction")).toBe("a, b или c");
  expect(formatDateTime("2026-10-21T10:05:03Z", { timeZone: "UTC" })).toBe("21.10.2026, 10:05:03");
  expect(formatDate("not a date")).toBe("not a date");
});

it("ignores values that are not languages", () => {
  setLanguage("xx" as never);
  expect(getLanguage()).toBe("zh");
});

it("returns marked strings unchanged", () => {
  expect(msg("coze.core.save")).toBe("coze.core.save");
  expect(verbatim("其他")).toBe("其他");
});
