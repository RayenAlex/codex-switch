import { expect, it } from "vitest";
import fixtures from "../../../../../shared/model-order/fixtures.json";
import { sortRelayModels } from "./sortRelayModels";

it.each(fixtures)("sorts $name consistently with the Codex catalog", ({ input, expected }) => {
  const original = [...input];
  expect(sortRelayModels(input)).toEqual(expected);
  expect(sortRelayModels([...input].reverse())).toEqual(expected);
  expect(sortRelayModels([...input.slice(1), input[0]])).toEqual(expected);
  expect(input).toEqual(original);
});

it("does not mutate identifiers or input and supports empty and singleton lists", () => {
  const models = ["gpt-6-astra", "GPT-6.1-Sol"];
  expect(sortRelayModels(models)).toEqual(["GPT-6.1-Sol", "gpt-6-astra"]);
  expect(models).toEqual(["gpt-6-astra", "GPT-6.1-Sol"]);
  expect(sortRelayModels([])).toEqual([]);
  expect(sortRelayModels(["custom"])).toEqual(["custom"]);
});
