"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Smartphone,
  Bell,
  Wifi,
  WifiOff,
  QrCode,
  Fingerprint,
  Loader2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DeviceRow {
  id: string;
  platform: string;
  deviceModel: string | null;
  osVersion: string | null;
  appVersion: string | null;
  isActive: boolean;
  biometricEnabled: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

interface PushNotifRow {
  id: string;
  title: string;
  body: string | null;
  category: string;
  status: string;
  readAt: string | null;
  createdAt: string;
}

export default function MobilePage() {
  const t = useTranslations("mobile");
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [notifications, setNotifications] = useState<PushNotifRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [devRes, notifRes] = await Promise.all([
        fetch("/api/v1/mobile/devices"),
        fetch("/api/v1/mobile/push?limit=10"),
      ]);
      if (devRes.ok) {
        const data = await devRes.json();
        setDevices(data.data ?? []);
      }
      if (notifRes.ok) {
        const data = await notifRes.json();
        setNotifications(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const deactivateDevice = async (id: string) => {
    await fetch(`/api/v1/mobile/devices/${id}`, { method: "DELETE" });
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Feature Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.devices")}</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {devices.filter((d) => d.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.notifications")}</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {notifications.filter((n) => !n.readAt).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.biometric")}</CardTitle>
            <Fingerprint className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {devices.filter((d) => d.biometricEnabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.scanning")}</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t("stats.available")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Registered Devices */}
      <Card>
        <CardHeader>
          <CardTitle>{t("devices.title")}</CardTitle>
          <CardDescription>{t("devices.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("devices.empty")}</p>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {device.deviceModel ?? device.platform}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {device.platform} {device.osVersion} - v{device.appVersion}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {device.biometricEnabled && (
                      <Fingerprint className="h-4 w-4 text-green-500" />
                    )}
                    <Badge variant={device.isActive ? "default" : "secondary"}>
                      {device.isActive ? t("devices.active") : t("devices.inactive")}
                    </Badge>
                    {device.isActive && (
                      <Button variant="ghost" size="sm" onClick={() => deactivateDevice(device.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>{t("notifications.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("notifications.empty")}</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    !notif.readAt ? "bg-primary/5" : ""
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm">{notif.title}</p>
                    {notif.body && (
                      <p className="text-xs text-muted-foreground">{notif.body}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{notif.category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
