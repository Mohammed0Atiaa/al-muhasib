import { SignIn } from "@stackframe/stack";
import Link from "next/link";
import { stackServerApp } from "@/stack/server";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  try {
    const user = await stackServerApp.getUser();
    if (user) {
      redirect("/dashboard");
    }
  } catch (error) {
    // تجاوز أي خطأ مؤقت في الـ Promise لكي تظهر صفحة الدخول بسلاسة
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-purple-100">
      <div className="max-w-md w-full space-y-8 p-6">
        <SignIn />
        <div className="text-center mt-4">
          <Link href="/" className="text-sm text-purple-600 hover:underline">
            Go Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
