/**
 * ChangeSet and FileChange Types
 */

export type FileChangeType = 'create' | 'modify' | 'delete';

export interface FileChangeInfo {
  type: FileChangeType;
  path: string;
  content?: string;
  originalContent?: string;
  description?: string;
}

export interface ChangeSetInfo {
  id: string;
  timestamp: string;
  module: string;
  changes: FileChangeInfo[];
}
