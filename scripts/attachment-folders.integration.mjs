import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const root = neon(process.env.DATABASE_URL);
const schema = "kaja_upload_test_" + randomBytes(6).toString("hex");
const q = async (text, params=[]) => (await root.transaction([root.query(`set local search_path to ${schema}`),root.query(text,params)]))[1];
try {
  await root.query(`create schema ${schema}`);
  await q("create table members(id serial primary key,slug text)");
  await q("insert into members(slug) values('patrick')");
  await q("create table attachments(id serial primary key,brand text,filename text,pathname text unique,url text,size integer,uploaded_by integer references members(id),created_at timestamptz default now(),deleted_at timestamptz)");
  await q("insert into attachments(brand,filename,pathname,url,size,uploaded_by) values('kaja','old.pdf','old.pdf','private-pdf',100,1)");
  const statements = readFileSync(new URL("../drizzle/0023_attachment_folders.sql",import.meta.url),"utf8").split("--> statement-breakpoint");
  for(let pass=0;pass<2;pass++) for(const statement of statements) await q(statement);
  const [old] = await q("select * from attachments where filename='old.pdf'");
  assert.equal(old.content_type,"application/pdf");assert.equal(old.folder_id,null);
  const [folder] = await q("insert into attachment_folders(brand,title,subtitle,published,created_by) values('kaja','Invitations','Private',false,1) returning id");
  const insert = filename => q("insert into attachments(brand,filename,content_type,folder_id,pathname,url,size,uploaded_by) values('kaja',$1,'image/png',$2,$3,'private-png',100,1) on conflict do nothing returning id",[filename,folder.id,randomBytes(8).toString("hex")]);
  const parallel = await Promise.all(Array.from({length:4},()=>insert("Alex.png")));
  assert.equal(parallel.flat().length,1,"Retries must not duplicate an invitation");
  assert.equal((await q("select * from attachments where folder_id is null")).length,1,"Folder files must not appear in root");
  assert.equal((await q("select * from attachment_folders where published=true")).length,0,"Incomplete folder must be hidden");
  await q("update attachment_folders set published=true where id=$1",[folder.id]);
  assert.equal((await q("select * from attachment_folders where brand='kaja' and published=true")).length,1);
  await q("update attachments set deleted_at=now() where filename='Alex.png'");
  assert.equal((await insert("Alex.png")).length,1,"Deleted files can be uploaded again");
  console.log("Isolated folder migration, PDF compatibility, publication, and resumable uniqueness: passed.");
} finally { await root.query(`drop schema if exists ${schema} cascade`); }
