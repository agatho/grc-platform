"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleAccept = async () => {
    if (password && password !== confirmPassword) {
      setError("Passwoerter stimmen nicht ueberein");
      return;
    }
    if (password && password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const body: Record<string, string> = {};
      if (name.trim()) body.name = name.trim();
      if (password) body.password = password;

      const res = await fetch(`/api/v1/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const json = await res.json();
        setError(json.error ?? "Einladung konnte nicht angenommen werden");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-sm text-center space-y-4">
          <CheckCircle size={48} className="mx-auto text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Willkommen bei ARCTOS</h1>
          <p className="text-gray-600">
            Ihre Einladung wurde angenommen. Sie koennen sich jetzt anmelden.
          </p>
          <Button onClick={() => router.push("/login")} className="w-full">
            Zur Anmeldung
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Shield size={40} className="mx-auto text-blue-600 mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">ARCTOS GRC Platform</h1>
          <p className="text-gray-500 mt-1">Einladung annehmen</p>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-center gap-2">
              <XCircle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ihr Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Max Mustermann"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Mindestens 8 Zeichen"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort bestaetigen</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
          </div>

          <Button onClick={handleAccept} disabled={loading} className="w-full">
            {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />}
            Einladung annehmen
          </Button>

          <p className="text-xs text-gray-400 text-center">
            Self-hosted. ISO 27001 konform. Ihre Daten bleiben bei Ihnen.
          </p>
        </div>
      </div>
    </div>
  );
}
