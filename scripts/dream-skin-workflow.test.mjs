import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/dream-skin-resources.yml", import.meta.url), "utf8");
const scriptStart = workflow.indexOf("script: |") + "script: |".length;
const script = workflow.slice(scriptStart, workflow.indexOf("\n      - name: Upload resource archive", scriptStart));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const createRelease = new AsyncFunction("github", "context", "core", "process", script);
const VERSION = "resource-hash";
const TAG = `dream-skin-${VERSION}`;
const ASSETS = [`dream-skin-resources-${VERSION}.zip`, "LICENSE", "NOTICE.md", "SOURCES.json"];

function fixture({ published, drafts = [], lookupStatus = 404 } = {}) {
  const calls = [];
  const outputs = {};
  const repos = {
    async getReleaseByTag(input) {
      calls.push(["lookup", input]);
      if (published) return { data: published };
      throw Object.assign(new Error("Release lookup failed"), { status: lookupStatus });
    },
    listReleases() {},
    listReleaseAssets() {},
    async updateRelease(input) { calls.push(["update", input]); },
    async createRelease(input) { calls.push(["create", input]); return { data: { id: 42 } }; },
    async deleteReleaseAsset(input) { calls.push(["delete", input]); },
  };
  const github = {
    rest: { repos },
    async paginate(method, input) {
      calls.push(["list", input]);
      if (method === repos.listReleases) return drafts;
      assert.equal(method, repos.listReleaseAssets);
      return ASSETS.map((name, index) => ({ name, id: index + 1 }));
    },
  };
  const context = { repo: { owner: "owner", repo: "repo" }, sha: "release-commit" };
  const core = { info() {}, setOutput(name, value) { outputs[name] = value; } };
  const process = { env: { RESOURCE_VERSION: VERSION, RESOURCE_TAG: TAG } };
  return { calls, outputs, run: () => createRelease(github, context, core, process) };
}

test("reuses a published resource release even when the release list omits it", async () => {
  const run = fixture({ published: { id: 7, tag_name: TAG, draft: false } });
  await run.run();
  assert.equal(run.outputs.release_id, "7");
  assert.deepEqual(run.calls.map(([name]) => name), ["lookup", "update", "list"]);
  assert.equal(run.calls[2][1].release_id, 7);
  for (const name of ["upload_archive", "upload_license", "upload_notice", "upload_sources"]) {
    assert.equal(run.outputs[name], "false");
  }
});

test("prefers the published resource over a duplicate draft without deleting assets", async () => {
  const run = fixture({
    published: { id: 7, tag_name: TAG, draft: false },
    drafts: [{ id: 8, tag_name: TAG, draft: true }],
  });
  await run.run();
  assert.equal(run.outputs.release_id, "7");
  assert.equal(run.calls.some(([name]) => name === "delete" || name === "create"), false);
});

test("falls back to a matching draft when no published resource exists", async () => {
  const run = fixture({ drafts: [{ id: 8, tag_name: TAG, draft: true }] });
  await run.run();
  assert.equal(run.outputs.release_id, "8");
  assert.equal(run.calls.filter(([name]) => name === "delete").length, ASSETS.length);
  assert.equal(run.outputs.upload_archive, "true");
  assert.equal(run.calls.some(([name]) => name === "create"), false);
});

test("creates a draft only when neither lookup finds the resource", async () => {
  const run = fixture();
  await run.run();
  const created = run.calls.find(([name]) => name === "create")[1];
  assert.equal(created.tag_name, TAG);
  assert.equal(created.draft, true);
  assert.equal(run.outputs.release_id, "42");
  assert.equal(run.outputs.upload_archive, "true");
});

test("does not create a duplicate when the published lookup fails for another reason", async () => {
  const run = fixture({ lookupStatus: 403 });
  await assert.rejects(run.run(), /Release lookup failed/);
  assert.deepEqual(run.calls.map(([name]) => name), ["lookup"]);
});
