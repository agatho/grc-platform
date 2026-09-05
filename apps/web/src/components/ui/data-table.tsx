"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  pageSize?: number;
  toolbar?: React.ReactNode;
  /**
   * [E2E-TRIAGE-2026-09-02 · C-13] Accessible names for the icon-only
   * pagination buttons.
   *
   * [ARCTOS-FULL-2026-08-31 · OP-070] Sie sind jetzt optional im Wortsinn:
   * fehlt der Wert, kommt er aus dem Katalog (`table.previousPage` /
   * `table.nextPage`) statt aus einer englischen Vorgabe im Code. Dasselbe
   * gilt fuer `searchPlaceholder`.
   */
  previousPageLabel?: string;
  nextPageLabel?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder,
  pageSize = 10,
  toolbar,
  previousPageLabel,
  nextPageLabel,
}: DataTableProps<TData, TValue>) {
  // [ARCTOS-FULL-2026-08-31 · OP-070] Der Rahmen dieser Tabelle war fest auf
  // ENGLISCH verdrahtet — „No results.", „row(s)", „Page x of y",
  // „Filter..." — in einem Produkt, dessen Vorgabesprache Deutsch ist. Der
  // Fehler lief also in beide Richtungen: der englische Nutzer sah Deutsch,
  // der deutsche sah hier Englisch. 27 Dateien binden diese Komponente ein,
  // die Korrektur steht deshalb einmal hier statt 27-mal an den Aufrufstellen.
  const t = useTranslations("table");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, columnFilters, columnVisibility },
    initialState: { pagination: { pageSize } },
  });

  return (
    <div className="space-y-4">
      {/* Toolbar: search + custom actions */}
      <div className="flex items-center justify-between gap-4">
        {searchKey && (
          <input
            placeholder={searchPlaceholder ?? t("filterPlaceholder")}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ""
            }
            onChange={(e) =>
              table.getColumn(searchKey)?.setFilterValue(e.target.value)
            }
            className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>

      {/* Table */}
      <div className="rounded-md border border-gray-200">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-gray-500"
                >
                  {t("noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {t("rowCount", {
            count: String(table.getFilteredRowModel().rows.length),
          })}
        </span>
        <div className="flex items-center gap-2">
          <span>
            {t("pageOf", {
              page: String(table.getState().pagination.pageIndex + 1),
              total: String(table.getPageCount()),
            })}
          </span>
          {/* [E2E-TRIAGE-2026-09-02 · C-13] These two carry an icon and
              nothing else, so their accessible name was empty and axe reports
              `button-name` with impact CRITICAL — a screen-reader user hears
              "button, button" and has no way to page a table. Every list view
              in the product uses this component, so the finding is one line
              here rather than N in the pages. `aria-hidden` on the glyph stops
              the icon font from being announced alongside the label. */}
          <button
            type="button"
            aria-label={previousPageLabel ?? t("previousPage")}
            title={previousPageLabel ?? t("previousPage")}
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-gray-300 p-1.5 disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={nextPageLabel ?? t("nextPage")}
            title={nextPageLabel ?? t("nextPage")}
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-md border border-gray-300 p-1.5 disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Helper: sortable column header */
export function SortableHeader({
  column,
  children,
}: {
  column: {
    toggleSorting: (desc?: boolean) => void;
    getIsSorted: () => false | "asc" | "desc";
  };
  children: React.ReactNode;
}) {
  return (
    <button
      className="flex items-center gap-1 hover:text-gray-900"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children}
      <ArrowUpDown size={14} className="text-gray-400" />
    </button>
  );
}
