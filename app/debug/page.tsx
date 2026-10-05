import { cookies } from "next/headers";
import { stackServerApp } from "../../stack/server";

export const dynamic = "force-dynamic";

export default async function Debug() {
  const names = (await cookies()).getAll().map((c) => c.name);
  const u = process.env.DATABASE_URL ?? "";
  let hasUser = false;
  try {
    hasUser = !!(await stackServerApp.getUser());
  } catch {}
  return (
    <pre style={{ padding: 20 }}>
      {JSON.stringify(
        {
          cookieNames: names,
          hasUser,
          dbUrlLength: u.length,
          dbUrlStart: u.slice(0, 14),
          dbUrlEnd: u.slice(-12),
          dbUrlHasWhitespace: /\s/.test(u),
        },
        null,
        2
      )}
    </pre>
  );
}
