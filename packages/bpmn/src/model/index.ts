/**
 * Public surface of the model layer.
 *
 * `apps/web` never touches `bpmn-moddle` through this package directly; it
 * imports from here, so the registry (and with it the ARCTOS extension) is
 * created exactly once and in exactly one way.
 */

export {
  ARCTOS_METADATA_LOCAL_TYPE,
  ARCTOS_NAMESPACE,
  ARCTOS_PREFIX,
  BPMNDI_NAMESPACE,
  BPMN_NAMESPACE,
  DC_NAMESPACE,
  DI_NAMESPACE,
  arctosExtensionDescriptor,
  arctosModdle,
  createArctosModdle,
} from "./moddle";

export {
  BpmnExportError,
  BpmnImportError,
  exportXml,
  getPreservedSource,
  importXml,
  isUnmodified,
  markModified,
  roundTrip,
  type ExportOptions,
  type ImportOptions,
  type ImportResult,
} from "./io";

export * from "./access";
export * from "./types";
