import { redirect } from "next/navigation";

export default function PaymentVoucherRedirect() {
  redirect("/expenses/payments/new");
}
