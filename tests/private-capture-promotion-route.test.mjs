import assert from "node:assert/strict";
import test from "node:test";
import {
  DELETE,
  POST,
  PUT,
} from "../app/api/import/promote/route.ts";

function request(url, method, body) {
  return new Request(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    method,
  });
}

test("promotion endpoint rejects a public host before any filesystem access", async () => {
  const response = await POST(
    request("https://example.com/api/import/promote", "POST", {
      captureId: "capture_route_0000000001",
      promotedBy: "editor",
      publicId: "obra",
    }),
  );
  assert.equal(response.status, 403);
});

test("promotion endpoint reports invalid local commands without leaking paths", async () => {
  const promote = await POST(
    request("http://localhost:3000/api/import/promote", "POST", {
      captureId: "invalido",
      promotedBy: "editor",
      publicId: "obra",
    }),
  );
  const promoteBody = await promote.json();
  assert.equal(promote.status, 400);
  assert.equal(promoteBody.code, "INVALID_PRIVATE_CAPTURE");

  const rollback = await DELETE(
    request("http://localhost:3000/api/import/promote", "DELETE", {
      rolledBackBy: "editor",
      transactionId: "invalida",
    }),
  );
  const rollbackBody = await rollback.json();
  assert.equal(rollback.status, 400);
  assert.equal(rollbackBody.code, "INVALID_PROMOTION");

  const recovery = await PUT(
    request("https://example.com/api/import/promote", "PUT"),
  );
  assert.equal(recovery.status, 403);
});
