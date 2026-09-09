import { NextResponse } from "next/server";
import { isAdminRequest } from "@/app/lib/admin-auth";
import { logAuditEvent } from "@/app/lib/audit";
import { serverSupabase } from "@/app/lib/server-supabase";
import {
  createSafeStorageFileName,
  enforceRateLimit,
  getClientIp,
  getSafeFileExtension,
  isAllowedImageExtension,
  isAllowedImageMimeType,
  sameOriginRequest,
  sanitizeText,
} from "@/app/lib/security";

const uploadConfig = {
  "driver-license": {
    bucket: "driver-licenses",
    prefix: "documents",
    maxBytes: 5 * 1024 * 1024,
    adminOnly: false,
  },
  "id-card": {
    bucket: "id-cards",
    prefix: "documents",
    maxBytes: 5 * 1024 * 1024,
    adminOnly: false,
  },
  "inspection-photo": {
    bucket: "return-inspection-images",
    prefix: "inspection",
    maxBytes: 8 * 1024 * 1024,
    adminOnly: true,
  },
} as const;

export async function POST(req: Request) {
  if (!sameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const rateLimit = enforceRateLimit(`upload:${ip}`, {
    limit: 12,
    windowMs: 15 * 60 * 1000,
    blockMs: 10 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many upload attempts. Please try again later." },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const kind = sanitizeText(formData.get("kind"), 40) as keyof typeof uploadConfig;
  const file = formData.get("file");
  const bookingId = sanitizeText(formData.get("bookingId"), 80) || "anonymous";

  if (!kind || !(kind in uploadConfig)) {
    return NextResponse.json({ error: "Invalid upload type." }, { status: 400 });
  }

  const config = uploadConfig[kind];

  if (config.adminOnly && !isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  const extension = getSafeFileExtension(file.name);
  const mimeType = file.type || "application/octet-stream";

  if (!isAllowedImageExtension(extension) || !isAllowedImageMimeType(mimeType)) {
    return NextResponse.json(
      { error: "Only JPG, JPEG, PNG and WEBP files are allowed." },
      { status: 400 }
    );
  }

  if (file.size <= 0 || file.size > config.maxBytes) {
    return NextResponse.json(
      { error: "File is too large or empty." },
      { status: 400 }
    );
  }

  const storagePath = createSafeStorageFileName(
    `${config.prefix}/${bookingId}`,
    extension
  );
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error } = await serverSupabase.storage
    .from(config.bucket)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = serverSupabase.storage.from(config.bucket).getPublicUrl(storagePath);
  await logAuditEvent({
    action: "file_upload",
    actorRole: config.adminOnly ? "admin" : "anonymous",
    targetType: "storage_object",
    targetId: storagePath,
    status: "success",
    details: `Uploaded ${kind} to ${config.bucket}.`,
    req,
  });

  return NextResponse.json({ url: data.publicUrl, path: storagePath });
}
