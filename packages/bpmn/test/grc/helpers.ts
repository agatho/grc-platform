/// <reference lib="dom" />

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildScene, type Scene } from "../../src/draw/scene";
import { importXml } from "../../src/model/index";
import { buildOverlayModel, type GrcOverlayModel } from "../../src/grc/engine";
import type { GrcOverlayData } from "../../src/grc/contract";
import { buildLayerContext, type GrcLayerContext } from "../../src/grc/layers";
import { viewById, type GrcViewId } from "../../src/grc/views";

const here = dirname(fileURLToPath(import.meta.url));
export const CORPUS_DIR = join(here, "..", "corpus");
export const RENDERED_DIR = join(here, "rendered");

export function corpusXml(name: string): string {
  return readFileSync(join(CORPUS_DIR, `${name}.bpmn`), "utf8");
}

/** Lädt ein Korpusdiagramm als Szene. */
export async function corpusScene(name: string): Promise<Scene> {
  const result = await importXml(corpusXml(name));
  return buildScene(result.definitions);
}

/** Szene + Layer-Kontext, für die Prüfung der Rechenkerne. */
export async function corpusContext(
  name: string,
  data: GrcOverlayData,
): Promise<{ scene: Scene; context: GrcLayerContext }> {
  const scene = await corpusScene(name);
  return { scene, context: buildLayerContext(scene, data) };
}

/** Szene + fertiges Überlagerungsmodell in einer Sicht. */
export async function corpusModel(
  name: string,
  data: GrcOverlayData,
  view: GrcViewId,
  options: { readonly selectedConflictId?: string } = {},
): Promise<{ scene: Scene; model: GrcOverlayModel }> {
  const scene = await corpusScene(name);
  const model = buildOverlayModel(scene, data, {
    view: viewById(view),
    ...(options.selectedConflictId
      ? { selectedConflictId: options.selectedConflictId }
      : {}),
  });
  return { scene, model };
}
