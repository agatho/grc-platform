// Sprint 1.3: Module System Types & Constants

export const MODULE_KEYS = [
  'erm', 'bpm', 'ics', 'dms', 'isms', 'bcms',
  'dpms', 'audit', 'tprm', 'contract', 'esg', 'whistleblowing', 'reporting', 'eam'
] as const;

export type ModuleKey = typeof MODULE_KEYS[number];
export type ModuleUiStatus = 'disabled' | 'preview' | 'enabled' | 'maintenance';

export interface ModuleDefinition {
  moduleKey: ModuleKey;
  displayNameDe: string;
  displayNameEn: string;
  descriptionDe: string | null;
  descriptionEn: string | null;
  icon: string;
  navPath: string;
  navSection: string;
  navOrder: number;
  requiresModules: ModuleKey[];
  licenseTier: string;
  isActiveInPlatform: boolean;
  backgroundProcesses: string[];
}

export interface ModuleConfig {
  moduleKey: ModuleKey;
  uiStatus: ModuleUiStatus;
  isDataActive: boolean;
  config: Record<string, unknown>;
  enabledAt: string | null;
  licenseTier: string;
  // Joined from module_definition:
  displayNameDe: string;
  displayNameEn: string;
  descriptionDe: string | null;
  descriptionEn: string | null;
  icon: string;
  navPath: string;
  navSection: string;
  navOrder: number;
  requiresModules: ModuleKey[];
}
