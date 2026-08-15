import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../app/api/import/publication/route.ts";

test("publication endpoint rejects public hosts and origins", async () => {
  const publicHost = await GET(
    new Request("https://example.com/api/import/publication"),
  );
  assert.equal(publicHost.status, 403);

  const publicOrigin = await POST(
    new Request("http://localhost:3000/api/import/publication", {
      body: JSON.stringify({ action: "verify" }),
      headers: {
        "Content-Type": "application/json",
        Origin: "https://example.com",
      },
      method: "POST",
    }),
  );
  assert.equal(publicOrigin.status, 403);
});
