export function tafqeet(amount: number, currencyCode: string = "KWD"): string {
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 1000); // 3 خانات عشرية بالفلس / قرش

  const currencyNames: Record<string, { main: string; sub: string }> = {
    EGP: { main: "جنيه مصري", sub: "قرش" },
    KWD: { main: "دينار كويتي", sub: "فلس" },
    SAR: { main: "ريال سعودي", sub: "هللة" },
    USD: { main: "دولار أمريكي", sub: "سنت" },
  };

  const curr = currencyNames[currencyCode] || { main: currencyCode, sub: "" };

  if (amount === 0) return `صفر ${curr.main} لا غير`;

  // تحويل مبسط للأرقام الأساسية
  let result = `فقط ${integerPart} ${curr.main}`;
  if (decimalPart > 0) {
    result += ` و ${decimalPart} ${curr.sub}`;
  }
  result += " لا غير";

  return result;
}
