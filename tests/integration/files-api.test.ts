import { describe, expect, it } from "vitest";
import { POST as registerFile } from "@/app/api/files/route";
import {
  DELETE as deleteFile,
  PATCH as updateFile,
} from "@/app/api/files/[fileId]/route";
import { db } from "@/lib/db";
import { createUser, jsonRequest, params, signInAs } from "./helpers";

async function makeRoom(ownerId: string) {
  return db.dataRoom.create({ data: { name: "Neptune", ownerId } });
}

function uploadPayload(overrides: Record<string, unknown> = {}) {
  return {
    roomId: "",
    folderId: null,
    name: "NDA.pdf",
    size: 1024,
    mimeType: "application/pdf",
    storageKey: "local:deadbeef",
    ...overrides,
  };
}

describe("POST /api/files (register upload)", () => {
  it("creates a new file at version 1", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);

    const res = await registerFile(
      jsonRequest("http://t/api/files", "POST", uploadPayload({ roomId: room.id }))
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.version).toBe(1);
    expect(body.file.name).toBe("NDA.pdf");
  });

  it("uploading the same name again stacks a new version instead of duplicating", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);

    await registerFile(jsonRequest("http://t/api/files", "POST", uploadPayload({ roomId: room.id })));
    const res = await registerFile(
      jsonRequest("http://t/api/files", "POST", uploadPayload({ roomId: room.id, storageKey: "local:v2" }))
    );
    const body = await res.json();
    expect(body.version).toBe(2);

    expect(await db.file.count({ where: { roomId: room.id, name: "NDA.pdf" } })).toBe(1);
    expect(await db.fileVersion.count({ where: { file: { roomId: room.id } } })).toBe(2);
  });
});

describe("PATCH /api/files/:fileId (rename)", () => {
  it("rejects a name that collides in the same folder", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);
    await db.file.create({
      data: { name: "Existing.pdf", roomId: room.id, folderId: null, size: 1, mimeType: "application/pdf" },
    });
    const target = await db.file.create({
      data: { name: "Mine.pdf", roomId: room.id, folderId: null, size: 1, mimeType: "application/pdf" },
    });

    const res = await updateFile(
      jsonRequest(`http://t/api/files/${target.id}`, "PATCH", { name: "Existing.pdf" }),
      params({ fileId: target.id })
    );
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/files/:fileId (move)", () => {
  it("auto-renames on a name clash in the destination folder", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);
    const destination = await db.folder.create({
      data: { name: "Legal", roomId: room.id, parentId: null, path: "/" },
    });
    await db.file.create({
      data: { name: "NDA.pdf", roomId: room.id, folderId: destination.id, size: 1, mimeType: "application/pdf" },
    });
    const moving = await db.file.create({
      data: { name: "NDA.pdf", roomId: room.id, folderId: null, size: 1, mimeType: "application/pdf" },
    });

    const res = await updateFile(
      jsonRequest(`http://t/api/files/${moving.id}`, "PATCH", { folderId: destination.id }),
      params({ fileId: moving.id })
    );
    const body = await res.json();
    expect(body.renamedTo).toBe("NDA (2).pdf");
    expect(body.file.folderId).toBe(destination.id);
  });

  it("rejects moving a file into a folder from a different room", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    const otherRoom = await makeRoom(owner.id);
    signInAs(owner);
    const foreignFolder = await db.folder.create({
      data: { name: "Elsewhere", roomId: otherRoom.id, parentId: null, path: "/" },
    });
    const file = await db.file.create({
      data: { name: "a.pdf", roomId: room.id, folderId: null, size: 1, mimeType: "application/pdf" },
    });

    const res = await updateFile(
      jsonRequest(`http://t/api/files/${file.id}`, "PATCH", { folderId: foreignFolder.id }),
      params({ fileId: file.id })
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/files/:fileId", () => {
  it("removes the file and all of its versions", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);
    const file = await db.file.create({
      data: { name: "a.pdf", roomId: room.id, folderId: null, size: 1, mimeType: "application/pdf" },
    });
    await db.fileVersion.create({ data: { fileId: file.id, version: 1, storageKey: "local:x", size: 1 } });

    const res = await deleteFile(jsonRequest(`http://t/api/files/${file.id}`, "DELETE"), params({ fileId: file.id }));
    expect(res.status).toBe(200);
    expect(await db.file.findUnique({ where: { id: file.id } })).toBeNull();
    expect(await db.fileVersion.count({ where: { fileId: file.id } })).toBe(0);
  });
});
