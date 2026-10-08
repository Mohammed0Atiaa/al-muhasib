          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right min-w-[900px]">
                <thead className="bg-gray-50 text-gray-500 border-b">
                  <tr>
                    <th className="p-4 w-[20%]">اسم العميل</th>
                    <th className="p-4 w-[15%]">الهاتف</th>
                    <th className="p-4 w-[15%]">المشتريات</th>
                    <th className="p-4 w-[15%]">المسدد</th>
                    <th className="p-4 w-[15%]">المتبقي</th>
                    <th className="p-4 w-[10%]">الحالة</th>
                    <th className="p-4 w-[10%] text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customersWithTotals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        لا يوجد عملاء مضافين حالياً
                      </td>
                    </tr>
                  ) : (
                    customersWithTotals.map((c: any) => (
                      <tr key={c.id} className={`hover:bg-gray-50 ${c.isBlacklisted ? "bg-red-50/40" : ""}`}>
                        <td className="p-4">
                          <div className="font-bold text-gray-900">{c.name}</div>
                          <div className="text-[10px] text-gray-400">ID: {c.id.slice(-6)}</div>
                        </td>
                        <td className="p-4 text-gray-600 dir-ltr text-right">{c.phone || "-"}</td>
                        <td className="p-4 font-semibold text-gray-800">{c.totalPurchases.toFixed(3)}</td>
                        <td className="p-4 font-semibold text-green-600">{c.totalPaid.toFixed(3)}</td>
                        <td className="p-4 font-semibold">
                          <span
                            className={`px-2 py-1 rounded-md text-xs ${
                              c.totalBalance > 0 ? "bg-red-100 text-red-700 font-bold" : "text-gray-500"
                            }`}
                          >
                            {c.totalBalance.toFixed(3)}
                          </span>
                        </td>
                        <td className="p-4">
                          {c.isBlacklisted ? (
                            <span className="px-2 py-0.5 text-xs bg-red-600 text-white font-bold rounded-md">
                              محظور
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 font-semibold rounded-md">
                              نشط
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <CustomerActions customer= {c} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
