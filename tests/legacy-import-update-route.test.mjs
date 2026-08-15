import assert from "node:assert/strict";
import test from "node:test";
import { DELETE, PUT } from "../app/api/import/route.ts";

test("aposenta a atualizacao direta de assets publicos no host local", async () => {
  const response = await PUT(
    new Request("http://localhost:3000/api/import", {
      body: "corpo deliberadamente nao processavel",
      method: "PUT",
    }),
  );
  const result = await response.json();

  assert.equal(response.status, 410);
  assert.equal(result.code, "LEGACY_IMPORT_UPDATE_RETIRED");
  assert.equal(result.editor, "/import/obras/{workId}/editar");
});

test("mantem a API aposentada inacessivel em host publico", async () => {
  const response = await PUT(
    new Request("https://example.com/api/import", { method: "PUT" }),
  );

  assert.equal(response.status, 403);
});

test("aposenta a exclusao direta de assets publicos", async () => {
  const response = await DELETE(
    new Request("http://localhost:3000/api/import?id=asa-branca", {
      method: "DELETE",
    }),
  );
  const result = await response.json();

  assert.equal(response.status, 410);
  assert.equal(result.code, "LEGACY_IMPORT_DELETE_RETIRED");
});
