import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "../../../stack/server"; // نفس مسار استيرادك

export const GET = StackHandler(stackServerApp);
export const POST = StackHandler(stackServerApp);
