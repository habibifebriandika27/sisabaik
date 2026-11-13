import { createHash } from "node:crypto";
import sharp from "sharp";
import { HttpError } from "./api.js";

const tipe = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function olahFoto(nilai) {
  if (nilai === undefined) return { mode: "keep" };
  if (nilai === null) return { mode: "hapus" };
  if (typeof nilai !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", "Format foto tidak valid.");
  }
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(nilai);
  if (!m || !tipe.has(m[1].toLowerCase())) {
    throw new HttpError(400, "VALIDATION_ERROR", "Foto harus JPEG, PNG, atau WebP.");
  }
  let sumber;
  try {
    sumber = Buffer.from(m[2], "base64");
  } catch {
    throw new HttpError(400, "VALIDATION_ERROR", "Data foto tidak dapat dibaca.");
  }
  if (sumber.length === 0 || sumber.length > 2 * 1024 * 1024) {
    throw new HttpError(400, "VALIDATION_ERROR", "Ukuran foto maksimal 2 MiB.");
  }
  let buffer;
  try {
    buffer = await sharp(sumber, { failOn: "error" })
      .rotate()
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new HttpError(400, "VALIDATION_ERROR", "Foto tidak dapat diproses.");
  }
  if (buffer.length > 409600) {
    throw new HttpError(400, "VALIDATION_ERROR", "Hasil foto melebihi batas penyimpanan.");
  }
  return {
    mode: "set",
    buffer,
    tipe: "image/webp",
    hash: createHash("sha256").update(buffer).digest("hex"),
  };
}
