import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminRequest } from "@/lib/auth";
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
    const gate = await requireAdminRequest(req);
    if (!gate.ok) return gate.res;

    const userId = new ObjectId(gate.auth.id);
    const db = await getDb();

    const traffic = await db.collection("traffic").aggregate([
        {
            $match: { userId }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$at" }
                },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { _id: 1 }
        }
    ]).toArray();

    return NextResponse.json(traffic);
}