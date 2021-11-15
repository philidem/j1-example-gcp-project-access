import PQueue from 'p-queue';
import { Opaque } from 'type-fest';
import { LoggerContext } from '~/src/context';
import { JupiterOneClient } from '~/src/j1Client/types';

export type IamBindingRelationship = {
  bindingEntityId: string;
  otherEntityId: string;
};

export type ProjectAccess = {
  _id: ProjectEntityId;
  _integrationInstanceId: string;
  _integrationName: string;
  displayName?: string;
  projectId?: string;
  iamBindings: IamBinding[];
  organizationName?: string;
  organizationDisplayName?: string;
  folderName?: string;
  folderDisplayName?: string;
};

export type OrganizationEntityId = Opaque<string, 'OrganizationEntityId'>;
export type FolderEntityId = Opaque<string, 'FolderEntityId'>;
export type ProjectEntityId = Opaque<string, 'ProjectEntityId'>;
export type IamBindingEntityId = Opaque<string, 'IamBindingEntityId'>;

export type CollectProjectAccessContext = LoggerContext & {
  j1Client: JupiterOneClient;
  j1qlWorkQueue: PQueue;
};

export type OrganizationGraphNode = {
  _id: OrganizationEntityId;
  _integrationInstanceId: string;
  _integrationName: string;
  displayName?: string;
  name?: string;
  childFolders: FolderGraphNode[];
  childProjects: ProjectGraphNode[];
};

export type FolderGraphNode = {
  _id: FolderEntityId;
  name?: string;
  displayName?: string;
  organization?: OrganizationGraphNode;
  parentFolder?: FolderGraphNode;
  childFolders: FolderGraphNode[];
  childProjects: ProjectGraphNode[];
};

export type ProjectGraphNode = {
  _id: ProjectEntityId;
  _integrationInstanceId: string;
  _integrationName: string;
  displayName?: string;
  projectId?: string;
  parentFolder?: FolderGraphNode;
  parentOrganization?: OrganizationGraphNode;
};

export type FolderHierarchy = {
  folderByEntityIdLookup: FolderLookup;
  rootFolders: FolderGraphNode[];
};

export type ProjectLookup = Record<ProjectEntityId, ProjectGraphNode>;

export type FolderLookup = Record<FolderEntityId, FolderGraphNode>;

export type OrganizationLookup = Record<
  OrganizationEntityId,
  OrganizationGraphNode
>;

export type IamBindingOtherEntityType =
  | 'google_cloud_organization'
  | 'google_cloud_folder'
  | 'google_cloud_project';

export type IamBinding = {
  _id: IamBindingEntityId;
  members: string[];
  permissions: string[];
  role: string | undefined;
};

export type IamBindingLookup = {
  [key in IamBindingOtherEntityType]: Record<string, IamBinding[] | undefined>;
};

export type CollectProjectAccessOutput = {
  folderHierarchy: FolderHierarchy;
  projectByIdLookup: ProjectLookup;
  organizationByIdLookup: OrganizationLookup;
  iamBindingLookup: IamBindingLookup;
  filterByRole: Set<string> | undefined;
  projects: ProjectAccess[];
};
