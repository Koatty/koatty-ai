/**
 * Koatty AI Specification Type Definitions
 */

export interface Field {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'datetime' | 'text' | 'json';
  primary?: boolean;
  auto?: boolean;
  unique?: boolean;
  required?: boolean;
  length?: number;
  format?: string;
  default?: any;
  nullable?: boolean;
  private?: boolean;
  comment?: string;
  values?: string[]; // For enum type
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  action: string;
  auth?: boolean;
  roles?: string[];
  pagination?: boolean;
  search?: string[];
}

export interface ApiConfig {
  basePath: string;
  endpoints: ApiEndpoint[];
}

export interface DtoConfig {
  create?: string[];
  update?: string[];
  query?: string[];
}

export interface AuthConfig {
  enabled: boolean;
  defaultRoles?: string[];
}

export interface FeatureConfig {
  softDelete?: boolean;
  pagination?: boolean;
  search?: boolean;
  audit?: boolean;
}

export interface Spec {
  module: string;
  table?: string;
  fields: Record<string, Field>;
  api?: ApiConfig;
  dto?: DtoConfig;
  auth?: AuthConfig;
  features?: FeatureConfig;
}
