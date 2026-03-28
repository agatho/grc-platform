"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Upload, Download, FileSpreadsheet } from "lucide-react";

import { ModuleGate } from "@/components/module/module-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ImportExportPage() {
  return (
    <ModuleGate moduleKey="eam">
      <ImportExportInner />
    </ModuleGate>
  );
}

function ImportExportInner() {
  const t = useTranslations("eam");
  const [importing, setImporting] = useState(false);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("import.title")}</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* ArchiMate Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t("import.archimateImport")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload .archimate XML files from Archi or other ArchiMate tools.
            </p>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag and drop .archimate file or click to browse
              </p>
            </div>
            <Button className="w-full" disabled={importing}>
              {importing ? "Importing..." : t("import.preview")}
            </Button>
          </CardContent>
        </Card>

        {/* CSV Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {t("import.csvImport")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import application portfolio from CSV/Excel files.
            </p>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag and drop CSV file or click to browse
              </p>
            </div>
            <Button className="w-full" variant="outline">
              {t("import.preview")}
            </Button>
          </CardContent>
        </Card>

        {/* ArchiMate Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t("import.archimateExport")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export architecture model as ArchiMate Open Exchange XML.
            </p>
            <Button className="w-full" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              {t("import.archimateExport")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
