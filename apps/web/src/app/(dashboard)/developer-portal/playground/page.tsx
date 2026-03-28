"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Play,
  Save,
  Loader2,
  Code2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ApiPlaygroundPage() {
  const t = useTranslations("developerPortal");
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/api/v1/organizations");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<{
    statusCode: number;
    body: string;
    responseTimeMs: number;
  } | null>(null);
  const [executing, setExecuting] = useState(false);

  const execute = useCallback(async () => {
    setExecuting(true);
    try {
      const res = await fetch("/api/v1/playground/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, path, body: body || undefined }),
      });
      const data = await res.json();
      setResponse(data.data);
    } finally {
      setExecuting(false);
    }
  }, [method, path, body]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("playground")}</h1>
        <p className="text-muted-foreground">{t("playgroundSubtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            {t("request")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <select
              className="rounded-md border px-3 py-2 text-sm font-mono"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              className="flex-1 rounded-md border px-3 py-2 text-sm font-mono"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/api/v1/..."
            />
            <Button onClick={execute} disabled={executing}>
              {executing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {t("send")}
            </Button>
          </div>

          {["POST", "PUT", "PATCH"].includes(method) && (
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm font-mono min-h-[120px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='{"key": "value"}'
            />
          )}
        </CardContent>
      </Card>

      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {t("response")}
              <Badge variant={response.statusCode < 400 ? "default" : "destructive"}>
                {response.statusCode}
              </Badge>
              <span className="text-sm text-muted-foreground font-normal">
                {response.responseTimeMs}ms
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-4 text-sm font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(response.body), null, 2);
                } catch {
                  return response.body;
                }
              })()}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
