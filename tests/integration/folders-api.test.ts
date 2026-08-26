import { describe, expect, it } from "vitest";
import { POST as createFolder } from "@/app/api/folders/route";
import {
  DELETE as deleteFolder,
  PATCH as renameFolder,
} from "@/app/api/folders/[folderId]/route";
import { GET as folderStatsRoute } from "@/app/api/folders/[folderId]/stats/route";
import { childPathOf } from "@/lib/access";
import { db } from "@/lib/db";
import { createUser, jsonRequest, params, signInAs } from "./helpers";

async function makeRoom(ownerId: string) {
  return db.dataRoom.create({ data: { name: "Neptune", ownerId } });
}

describe("POST /api/folders", () => {
  it("creates a root-level folder with path '/'", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);

    const res = await createFolder(
      jsonRequest("http://t/api/folders", "POST", { roomId: room.id, parentId: null, name: "Financials" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.path).toBe("/");
  });

  it("derives a child's path from its parent", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);

    const parent = await db.folder.create({
      data: { name: "Financials", roomId: room.id, parentId: null, path: "/" },
    });
    const res = await createFolder(
      jsonRequest("http://t/api/folders", "POST", { roomId: room.id, parentId: parent.id, name: "2024" })
    );
    const body = await res.json();
    expect(body.path).toBe(childPathOf(parent));
  });

  it("auto-suffixes a duplicate folder name instead of erroring", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);
    await db.folder.create({ data: { name: "New folder", roomId: room.id, parentId: null, path: "/" } });

    const res = await createFolder(
      jsonRequest("http://t/api/folders", "POST", { roomId: room.id, parentId: null, name: "New folder" })
    );
    expect((await res.json()).name).toBe("New folder (2)");
  });
});

describe("PATCH /api/folders/:folderId (rename)", () => {
  it("rejects a name that collides with a sibling", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);
    await db.folder.create({ data: { name: "Legal", roomId: room.id, parentId: null, path: "/" } });
    const target = await db.folder.create({
      data: { name: "Financials", roomId: room.id, parentId: null, path: "/" },
    });

    const res = await renameFolder(
      jsonRequest(`http://t/api/folders/${target.id}`, "PATCH", { name: "Legal" }),
      params({ folderId: target.id })
    );
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/folders/:folderId", () => {
  it("cascades to nested folders and files, and revokes shares pointing inside", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);

    const parent = await db.folder.create({ data: { name: "Financials", roomId: room.id, parentId: null, path: "/" } });
    const child = await db.folder.create({
      data: { name: "2024", roomId: room.id, parentId: parent.id, path: childPathOf(parent) },
    });
    const file = await db.file.create({
      data: { name: "a.pdf", roomId: room.id, folderId: child.id, size: 1, mimeType: "application/pdf" },
    });
    const share = await db.share.create({
      data: {
        token: "tok-nested",
        resourceType: "FILE",
        resourceId: file.id,
        roomId: room.id,
        mode: "PUBLIC",
        createdById: owner.id,
      },
    });

    const res = await deleteFolder(
      jsonRequest(`http://t/api/folders/${parent.id}`, "DELETE"),
      params({ folderId: parent.id })
    );
    expect(res.status).toBe(200);

    expect(await db.folder.findUnique({ where: { id: child.id } })).toBeNull();
    expect(await db.file.findUnique({ where: { id: file.id } })).toBeNull();
    const revokedShare = await db.share.findUniqueOrThrow({ where: { id: share.id } });
    expect(revokedShare.revokedAt).not.toBeNull();
  });
});

describe("GET /api/folders/:folderId/stats", () => {
  it("reports subtree folder/file counts and total size", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);

    const parent = await db.folder.create({ data: { name: "Financials", roomId: room.id, parentId: null, path: "/" } });
    const child = await db.folder.create({
      data: { name: "2024", roomId: room.id, parentId: parent.id, path: childPathOf(parent) },
    });
    await db.file.create({
      data: { name: "a.pdf", roomId: room.id, folderId: child.id, size: 500, mimeType: "application/pdf" },
    });

    const res = await folderStatsRoute(
      jsonRequest(`http://t/api/folders/${parent.id}/stats`, "GET"),
      params({ folderId: parent.id })
    );
    expect(await res.json()).toEqual({ folders: 1, files: 1, bytes: 500 });
  });
});
