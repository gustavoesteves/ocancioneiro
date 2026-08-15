import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../app/api/import/review/route.ts";

test("review endpoint rejects public hosts and origins", async () => {
  const publicHost = await GET(new Request("https://example.com/api/import/review"));
  assert.equal(publicHost.status, 403);

  const publicOrigin = await GET(
    new Request("http://localhost:3000/api/import/review", {
      headers: { Origin: "https://example.com" },
    }),
  );
  assert.equal(publicOrigin.status, 403);
});
