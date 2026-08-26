import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handleApi, requireUser } from "@/lib/api-helpers";
import { listRoomsWithStats } from "@/lib/queries";
import { isValidName, normalizeName } from "@/lib/names";

export const GET = handleApi(async () => {
  const user = await requireUser();
  return NextResponse.json(await listRoomsWithStats(user.id));
});

const createSchema = z.object({
  name: z.string().transform(normalizeName).refine(isValidName, "Enter a name."),
});

export const POST = handleApi(async (request: Request) => {
  const user = await requireUser();
  const { name } = createSchema.parse(await request.json());

  const room = await db.dataRoom.create({
    data: { name, ownerId: user.id },
  });
  return NextResponse.json(room, { status: 201 });
});
