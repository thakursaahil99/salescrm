import "dotenv/config";
import mongoose from "mongoose";

// One-time, NON-destructive migration: copies every document from the two
// separate databases (marketing-crm, rbh_sales_crm) into one shared "crm"
// database. Nothing is deleted from the source databases — this only
// inserts into "crm", so it's safe to re-run (it clears just the "crm"
// copies of each collection first, never the originals).
const MARKETING_MAP = {
  users: "marketing_users",
  leads: "marketing_leads",
  remarks: "marketing_remarks",
  reminders: "marketing_reminders",
  fms: "marketing_fms",
  fmsentries: "marketing_fmsentries",
  fmsholidays: "marketing_fmsholidays",
};

async function copyAll(sourceDb, nameMap) {
  for (const [srcName, destName] of Object.entries(nameMap)) {
    const src = sourceDb.collection(srcName);
    const dest = mongoose.connection.useDb("crm", { useCache: true }).collection(destName);
    const docs = await src.find({}).toArray();
    await dest.deleteMany({}); // safe to re-run; only touches the "crm" copy
    if (docs.length) await dest.insertMany(docs);
    console.log(`${srcName} (${sourceDb.databaseName}) -> crm.${destName}: ${docs.length} docs`);
  }
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const marketingDb = mongoose.connection.useDb("marketing-crm", { useCache: true });
  await copyAll(marketingDb, MARKETING_MAP);

  const salesDb = mongoose.connection.useDb("rbh_sales_crm", { useCache: true });
  const salesCols = await salesDb.db.listCollections().toArray();
  const salesMap = Object.fromEntries(salesCols.map((c) => [c.name, c.name])); // same names, no prefix
  await copyAll(salesDb, salesMap);

  console.log("\nDone. Source databases (marketing-crm, rbh_sales_crm) were not modified.");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
