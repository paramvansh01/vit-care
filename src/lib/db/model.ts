/**
 * Pure schema-model types and constants.
 *
 * Deliberately free of any `node:sqlite` import so client components can use
 * these without dragging the database driver into the browser bundle.
 */

export type ErColumn = {
  name: string;
  type: string;
  notNull: boolean;
  pkOrder: number; // 0 = not part of PK
  isFk: boolean;
  isUnique: boolean;
  defaultValue: string | null;
  references: { table: string; column: string } | null;
};

export type TableKind =
  | "strong" // ordinary entity
  | "weak" // existence-dependent, partial key
  | "associative" // pure M:N junction
  | "subclass" // EER specialization child
  | "system"; // audit / log / alert plumbing

export type ModuleKey = "institution" | "clinical" | "condonation" | "pharmacy" | "security";

export type ErTable = {
  name: string;
  module: ModuleKey;
  kind: TableKind;
  columns: ErColumn[];
  primaryKey: string[];
  rowCount: number;
  indexes: { name: string; unique: boolean; columns: string[] }[];
  triggers: string[];
  ddl: string;
};

export type EdgeKind = "identifying" | "non-identifying" | "specialization" | "recursive";

export type ErEdge = {
  id: string;
  fromTable: string; // child / referencing table
  fromColumns: string[];
  toTable: string; // parent / referenced table
  toColumns: string[];
  onDelete: string;
  kind: EdgeKind;
  /** crow's-foot cardinality at the child end */
  childCardinality: "many" | "one";
  /** true when the FK is nullable - participation is partial */
  optional: boolean;
};

export type ErModel = {
  tables: ErTable[];
  edges: ErEdge[];
  views: { name: string; ddl: string }[];
  triggers: { name: string; table: string; ddl: string }[];
  stats: {
    tables: number;
    columns: number;
    relationships: number;
    triggers: number;
    views: number;
    indexes: number;
    rows: number;
  };
};

export const MODULES: Record<
  ModuleKey,
  { label: string; hue: string; accent: string; description: string }
> = {
  institution: {
    label: "Institution",
    hue: "#2563EB",
    accent: "#EFF6FF",
    description: "Campus, department, course, faculty and the student attendance ledger.",
  },
  clinical: {
    label: "Clinical",
    hue: "#0D9488",
    accent: "#F0FDFA",
    description: "EER doctor hierarchy, slots, triage, consultations and certificates.",
  },
  condonation: {
    label: "Condonation",
    hue: "#7C3AED",
    accent: "#F5F3FF",
    description: "The health → academics bridge generated automatically by triggers.",
  },
  pharmacy: {
    label: "Pharmacy",
    hue: "#EA580C",
    accent: "#FFF7ED",
    description: "Drugs, recursive interactions, inventory, orders and delivery.",
  },
  security: {
    label: "Security & Events",
    hue: "#64748B",
    accent: "#F8FAFC",
    description: "RBAC roles, audit trail and the live trigger event log.",
  },
};

export const MODULE_OF: Record<string, ModuleKey> = {
  campus: "institution",
  department: "institution",
  faculty: "institution",
  course: "institution",
  student: "institution",
  enrollment: "institution",

  doctor: "clinical",
  gp_doctor: "clinical",
  specialist_doctor: "clinical",
  counselor: "clinical",
  specialization: "clinical",
  doctor_specialization: "clinical",
  slot: "clinical",
  symptom: "clinical",
  appointment: "clinical",
  appointment_symptom: "clinical",
  consultation: "clinical",
  medical_certificate: "clinical",

  condonation_request: "condonation",

  drug: "pharmacy",
  drug_interaction: "pharmacy",
  pharmacy: "pharmacy",
  pharmacist: "pharmacy",
  inventory: "pharmacy",
  prescription: "pharmacy",
  prescription_item: "pharmacy",
  delivery_address: "pharmacy",
  pharmacy_order: "pharmacy",
  order_item: "pharmacy",
  delivery: "pharmacy",

  app_role: "security",
  app_user: "security",
  access_audit: "security",
  clinical_alert: "security",
  stock_alert: "security",
  trigger_log: "security",
};

export const SYSTEM_TABLES = new Set([
  "access_audit",
  "clinical_alert",
  "stock_alert",
  "trigger_log",
]);

export const TABLE_KIND_LABEL: Record<TableKind, string> = {
  strong: "Strong entity",
  weak: "Weak entity",
  associative: "Associative (M:N)",
  subclass: "EER subclass",
  system: "System / event",
};
