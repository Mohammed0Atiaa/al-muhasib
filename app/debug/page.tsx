import { cookies } from "next/headers";
import { stackServerApp } from "../../stack/server";

export const dynamic = "force-dynamic";

export default async function Debug() {
  const names = (await cookies()).getAll().map((c) => c.name);
  let hasUser = false;
  let err = "";
  try {
    hasUser = !!(await stackServerApp.getUser());
  } catch (e) {
    err = String(e);
  }
  return (
    <pre style={{ padding: 20 }}>
      {JSON.stringify({ cookieNames: names, hasUser, err }, null, 2)}
    </pre>
  );
}
