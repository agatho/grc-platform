"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import {
  Shield, Users, CheckCircle2, AlertTriangle, Clock, Loader2,
  UserCheck, UserX, RefreshCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UserRole {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  lineOfDefense: string;
  department: string | null;
  lastLogin: string | null;
  isActive: boolean;
}

export default function AccessReviewsPage() {
  const t = useTranslations("accessLog");
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<Set<string>>(new Set());
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [revoked, setRevoked] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/users?limit=200");
      if (res.ok) {
        const json = await res.json();
        const userData = (json.data ?? []).map((u: any) => ({
          userId: u.id,
          userName: u.name ?? "Unknown",
          userEmail: u.email ?? "",
          role: u.roles?.[0]?.role ?? "viewer",
          lineOfDefense: u.roles?.[0]?.lineOfDefense ?? "-",
          department: u.roles?.[0]?.department ?? null,
          lastLogin: u.lastLoginAt ?? null,
          isActive: u.isActive ?? true,
        }));
        setUsers(userData);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  const handleApprove = (userId: string) => {
    setApproved((prev) => new Set([...prev, userId]));
    setRevoked((prev) => { const n = new Set(prev); n.delete(userId); return n; });
  };

  const handleRevoke = (userId: string) => {
    setRevoked((prev) => new Set([...prev, userId]));
    setApproved((prev) => { const n = new Set(prev); n.delete(userId); return n; });
  };

  const totalReviewed = approved.size + revoked.size;
  const totalUsers = users.length;
  const progress = totalUsers > 0 ? Math.round((totalReviewed / totalUsers) * 100) : 0;

  const roleColors: Record<string, string> = {
    admin: "bg-red-100 text-red-900 border-red-300",
    risk_manager: "bg-orange-100 text-orange-900 border-orange-300",
    auditor: "bg-purple-100 text-purple-900 border-purple-300",
    control_owner: "bg-blue-100 text-blue-900 border-blue-300",
    dpo: "bg-indigo-100 text-indigo-900 border-indigo-300",
    process_owner: "bg-teal-100 text-teal-900 border-teal-300",
    viewer: "bg-gray-100 text-gray-900 border-gray-300",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Berechtigungsprüfung</h1>
          <p className="text-sm text-gray-500 mt-1">
            Periodische Überprüfung aller Nutzerzugriffe und Rollenberechtigungen
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers}>
          <RefreshCcw size={14} className="mr-1.5" />
          Aktualisieren
        </Button>
      </div>

      {/* Progress Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
                <p className="text-xs text-gray-500">Nutzer gesamt</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-green-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{approved.size}</p>
                <p className="text-xs text-gray-500">Bestätigt</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{revoked.size}</p>
                <p className="text-xs text-gray-500">Widerrufen</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{progress}%</p>
                <p className="text-xs text-gray-500">Fortschritt</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* User List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nutzerzugriffe prüfen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map((user) => {
              const isApproved = approved.has(user.userId);
              const isRevoked = revoked.has(user.userId);
              const isReviewed = isApproved || isRevoked;

              return (
                <div
                  key={user.userId}
                  className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors ${
                    isRevoked ? "border-red-200 bg-red-50/50" :
                    isApproved ? "border-green-200 bg-green-50/50" :
                    "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{user.userName}</p>
                      <Badge variant="outline" className={`text-[10px] ${roleColors[user.role] ?? ""}`}>
                        {user.role}
                      </Badge>
                      {user.lineOfDefense !== "-" && (
                        <Badge variant="outline" className="text-[10px]">
                          {user.lineOfDefense}. Linie
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{user.userEmail}</p>
                    {user.department && (
                      <p className="text-xs text-gray-400 mt-0.5">Abteilung: {user.department}</p>
                    )}
                  </div>

                  {/* Last Login */}
                  <div className="text-right shrink-0">
                    {user.lastLogin ? (
                      <p className="text-xs text-gray-500">
                        Letzter Login: {new Date(user.lastLogin).toLocaleDateString("de-DE")}
                      </p>
                    ) : (
                      <p className="text-xs text-red-500">Nie eingeloggt</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isReviewed ? (
                      <Badge variant="outline" className={
                        isApproved ? "bg-green-100 text-green-900 border-green-300" :
                        "bg-red-100 text-red-900 border-red-300"
                      }>
                        {isApproved ? "✓ Bestätigt" : "✗ Widerrufen"}
                      </Badge>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(user.userId)}
                          className="text-green-700 hover:bg-green-50 border-green-300"
                        >
                          <UserCheck size={14} className="mr-1" />
                          Bestätigen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevoke(user.userId)}
                          className="text-red-700 hover:bg-red-50 border-red-300"
                        >
                          <UserX size={14} className="mr-1" />
                          Widerrufen
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
