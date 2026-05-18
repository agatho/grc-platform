"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldX, FileSignature } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface SignOff {
  id: string;
  signerRole: string;
  signoffType: string;
  signedAt: string;
  comments: string | null;
  chainHash: string;
  payloadHash: string;
  previousChainHash: string | null;
}

export function ProcessSignOffTab({ processId }: { processId: string }) {
  const [rows, setRows] = useState<SignOff[]>([]);
  const [chainValid, setChainValid] = useState(true);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [signerRole, setSignerRole] = useState("process_owner");
  const [signoffType, setSignoffType] = useState("approval");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const resp = await fetch(`/api/v1/processes/${processId}/sign-off`);
    if (resp.ok) {
      const j = await resp.json();
      setRows(j.data?.signOffs ?? []);
      setChainValid(j.data?.chainValid ?? true);
    }
    setLoading(false);
  }, [processId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/v1/processes/${processId}/sign-off`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signerRole,
          signoffType,
          comments: comments || null,
        }),
      });
      if (resp.ok) {
        toast.success("Sign-off recorded");
        setOpen(false);
        setComments("");
        reload();
      } else {
        const e = await resp.json().catch(() => ({}));
        toast.error(e.error ?? "Sign-off failed");
      }
    } finally {
      setSubmitting(false);
    }
  }, [processId, signerRole, signoffType, comments, reload]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Sign-off Hash Chain
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            {chainValid ? (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Chain intact · {rows.length} signature(s)
              </>
            ) : (
              <>
                <ShieldX className="h-4 w-4 text-red-600" />
                <span className="text-red-600">
                  Chain integrity check failed
                </span>
              </>
            )}
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Sign-off</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record sign-off</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">As role</label>
                <Select value={signerRole} onValueChange={setSignerRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="process_owner">Process Owner</SelectItem>
                    <SelectItem value="quality_manager">
                      Quality Manager
                    </SelectItem>
                    <SelectItem value="compliance_officer">
                      Compliance Officer
                    </SelectItem>
                    <SelectItem value="risk_manager">Risk Manager</SelectItem>
                    <SelectItem value="ciso">CISO</SelectItem>
                    <SelectItem value="dpo">DPO</SelectItem>
                    <SelectItem value="auditor">Auditor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Sign-off type</label>
                <Select value={signoffType} onValueChange={setSignoffType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="approval">Approval</SelectItem>
                    <SelectItem value="publish">Publish</SelectItem>
                    <SelectItem value="retire">Retire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Comments</label>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Record
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No sign-offs yet.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline">{r.signoffType}</Badge>{" "}
                    <span className="font-medium">{r.signerRole}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.signedAt).toLocaleString()}
                  </div>
                </div>
                {r.comments && <div className="mt-1 text-sm">{r.comments}</div>}
                <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                  chain: {r.chainHash.slice(0, 24)}…
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
