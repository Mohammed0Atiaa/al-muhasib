  // جلب بيانات الشركة وسند الصرف بشكل آمن تماماً بدون علاقات معقدة تسبب خطأ 404
  const [company, payment] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    prisma.paymentVoucher.findFirst({
      where: { id, companyId },
      include: { expenseCategory: true }, // أزلنا علاقة user المباشرة لمنع أي خطأ
    }).catch(() => null),
  ]);

  if (!payment) {
    notFound();
  }

  // تصحيح اسم حقل العملة ليتطابق مع الـ Schema (baseCurrency)
  const currency = company?.baseCurrency || "KWD";
