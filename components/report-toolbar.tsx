"use client";

export default function ReportToolbar({
  filename,
  rows,
}: {
  filename: string;
  rows: (string | number)[][];
}) {
  function exportCsv() {
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const btn = "rounded-lg border bg-white px-4 py-2 text-sm font-medium";
  return (
    <div className="flex gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className={btn}>
        طباعة / PDF
      </button>
      <button type="button" onClick={exportCsv} className={btn}>
        تصدير Excel
      </button>
    </div>
  );
}
