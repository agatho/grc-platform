import { getExcelTemplateColumns } from "@grc/shared";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/import-excel/template — Download Excel template
export async function GET(_req: Request) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const columns = getExcelTemplateColumns();

  // Return CSV template (lightweight alternative to xlsx generation)
  const header = columns.join(",");
  const exampleRow = [
    "1",
    "Receive customer order",
    "Sales",
    "task",
    "",
    "2",
    "Order Form",
    "CRM System",
  ].join(",");

  const csv = [header, exampleRow].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bpmn-import-template.csv"',
    },
  });
}
