/**
 * Minimal in-memory stand-in for the MongoDB `Db` surface used by
 * lib/gameIngest.ts and lib/reportCsvIngest.ts, so ingestion math can be
 * tested locally without a database.
 *
 * It mirrors the unique indexes created in lib/db.ts that affect ingestion:
 *   - games:   { sourceDateTime: 1 } unique (global, sparse — but note the
 *     driver serializes `undefined` as `null`, and a present null IS indexed)
 *   - players: { playerTag: 1 } unique
 *
 * Duplicate-key failures are surfaced with the same shape the mongodb v7
 * driver uses (error.code / error.writeErrors[].{code,index} /
 * error.result.insertedIds containing only the successful inserts).
 */

type Doc = Record<string, any>;

class FakeBulkWriteError extends Error {
  code?: number;
  writeErrors: Array<{ code: number; index: number }>;
  result: { insertedIds: Record<number, string> };

  constructor(writeErrors: Array<{ code: number; index: number }>, insertedIds: Record<number, string>) {
    super("E11000 duplicate key error (fake)");
    this.writeErrors = writeErrors;
    this.result = { insertedIds };
  }
}

function valuesEqual(a: any, b: any) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function matches(doc: Doc, filter: Doc) {
  return Object.entries(filter).every(([key, value]) => valuesEqual(doc[key], value));
}

export class FakeCollection {
  name: string;
  docs: Doc[] = [];
  private uniqueKeyFns: Array<(doc: Doc) => string | undefined>;
  private nextId = 1;

  constructor(name: string) {
    this.name = name;
    this.uniqueKeyFns = [];
    if (name === "games") {
      // Legacy sparse unique index on sourceDateTime. The field is present on
      // every ingested doc (the driver serializes undefined as null), so it
      // always participates in the index — exactly like production. Dropped in
      // the Phase 3 index swap.
      this.uniqueKeyFns.push((doc) =>
        "sourceDateTime" in doc ? `sourceDateTime:${String(doc.sourceDateTime)}` : undefined
      );
      // Per-uploader dedupe index { uploaderId: 1, dedupeKey: 1 } (partial).
      this.uniqueKeyFns.push((doc) =>
        doc.uploaderId != null && doc.dedupeKey != null
          ? `dedupe:${String(doc.uploaderId)}:${String(doc.dedupeKey)}`
          : undefined
      );
    }
    if (name === "players") {
      this.uniqueKeyFns.push((doc) => (doc.playerTag != null ? `playerTag:${String(doc.playerTag)}` : undefined));
    }
  }

  private newId() {
    return `fake-id-${this.name}-${this.nextId++}`;
  }

  private duplicateOf(candidate: Doc, excluding?: Doc) {
    for (const keyFn of this.uniqueKeyFns) {
      const key = keyFn(candidate);
      if (key === undefined) continue;
      const clash = this.docs.find((doc) => doc !== excluding && keyFn(doc) === key);
      if (clash) return clash;
    }
    return undefined;
  }

  async insertOne(doc: Doc) {
    if (this.duplicateOf(doc)) {
      const err: any = new Error("E11000 duplicate key error (fake)");
      err.code = 11000;
      throw err;
    }
    const stored = { _id: this.newId(), ...doc };
    this.docs.push(stored);
    return { acknowledged: true, insertedId: stored._id };
  }

  async insertMany(docs: Doc[], _opts?: { ordered?: boolean }) {
    const insertedIds: Record<number, string> = {};
    const writeErrors: Array<{ code: number; index: number }> = [];

    docs.forEach((doc, index) => {
      if (this.duplicateOf(doc)) {
        writeErrors.push({ code: 11000, index });
        return;
      }
      const stored = { _id: this.newId(), ...doc };
      this.docs.push(stored);
      insertedIds[index] = stored._id;
    });

    if (writeErrors.length) {
      throw new FakeBulkWriteError(writeErrors, insertedIds);
    }
    return { acknowledged: true, insertedCount: Object.keys(insertedIds).length, insertedIds };
  }

  private applyUpdate(filter: Doc, update: Doc, upsert: boolean) {
    const existing = this.docs.find((doc) => matches(doc, filter));

    if (existing) {
      for (const [key, value] of Object.entries(update.$set ?? {})) existing[key] = value;
      for (const [key, value] of Object.entries(update.$inc ?? {})) {
        existing[key] = (Number(existing[key]) || 0) + Number(value);
      }
      for (const [key, value] of Object.entries(update.$min ?? {})) {
        const current = existing[key];
        if (current === undefined || (value as any) < current) existing[key] = value;
      }
      return { matched: 1, upserted: false };
    }

    if (!upsert) return { matched: 0, upserted: false };

    const doc: Doc = {};
    for (const [key, value] of Object.entries(filter)) doc[key] = value;
    for (const [key, value] of Object.entries(update.$setOnInsert ?? {})) doc[key] = value;
    for (const [key, value] of Object.entries(update.$set ?? {})) doc[key] = value;
    for (const [key, value] of Object.entries(update.$min ?? {})) doc[key] = value;
    for (const [key, value] of Object.entries(update.$inc ?? {})) doc[key] = Number(value);
    if (!("_id" in doc)) doc._id = this.newId();

    const clash = this.duplicateOf(doc);
    if (clash) {
      const err: any = new Error("E11000 duplicate key error (fake upsert)");
      err.code = 11000;
      throw err;
    }
    this.docs.push(doc);
    return { matched: 0, upserted: true };
  }

  async updateOne(filter: Doc, update: Doc, opts?: { upsert?: boolean }) {
    const res = this.applyUpdate(filter, update, Boolean(opts?.upsert));
    return { acknowledged: true, matchedCount: res.matched, upsertedCount: res.upserted ? 1 : 0 };
  }

  async bulkWrite(ops: Doc[], _opts?: { ordered?: boolean }) {
    const writeErrors: Array<{ code: number; index: number }> = [];
    ops.forEach((op, index) => {
      const spec = op.updateOne;
      if (!spec) throw new Error(`fakeDb bulkWrite only supports updateOne ops (got ${Object.keys(op).join(",")})`);
      try {
        this.applyUpdate(spec.filter, spec.update, Boolean(spec.upsert));
      } catch (e: any) {
        if (e?.code === 11000) writeErrors.push({ code: 11000, index });
        else throw e;
      }
    });
    if (writeErrors.length) throw new FakeBulkWriteError(writeErrors, {});
    return { acknowledged: true };
  }

  findOneSync(filter: Doc) {
    return this.docs.find((doc) => matches(doc, filter));
  }

  find(filter: Doc = {}) {
    const results = this.docs.filter((doc) => matches(doc, filter));
    return {
      toArray: async () => results,
      async *[Symbol.asyncIterator]() {
        for (const doc of results) yield doc;
      },
    };
  }

  async deleteMany(filter: Doc = {}) {
    const keep = this.docs.filter((doc) => !matches(doc, filter));
    const deletedCount = this.docs.length - keep.length;
    this.docs = keep;
    return { acknowledged: true, deletedCount };
  }
}

export class FakeDb {
  private collections = new Map<string, FakeCollection>();

  collection(name: string): any {
    let col = this.collections.get(name);
    if (!col) {
      col = new FakeCollection(name);
      this.collections.set(name, col);
    }
    return col;
  }

  col(name: string): FakeCollection {
    return this.collection(name) as FakeCollection;
  }
}

/** Runs fn with console.log silenced (CSV ingestion logs every row). */
export async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = original;
  }
}
