import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccessError } from "./company";

/** خطأ مقصود برسالة آمنة تُعرض للمستخدم */
export class ApiError extends Error {
  constructor(public status: 400 | 404 | 409 | 422, message: string) {
    super(message);
  }
}

/** يحوّل أي خطأ إلى استجابة JSON بدون تسريب رسائل داخلية */
export function apiError(e: unknown, fallback = "حدث خطأ غير متوقع") {
  if (e instanceof AccessError || e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: e.issues[0]?.message ?? "بيانات غير صحيحة" },
      { status: 422 }
    );
  }
  console.error(e);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
