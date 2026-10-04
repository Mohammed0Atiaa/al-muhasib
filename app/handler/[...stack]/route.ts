import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "@/stack/server";

export const GET = StackHandler(stackServerApp);
export const POST = StackHandler(stackServerApp);

