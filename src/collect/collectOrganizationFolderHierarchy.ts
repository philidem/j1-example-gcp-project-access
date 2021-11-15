import { Opaque } from 'type-fest';
import {
  CollectProjectAccessContext,
  FolderHierarchy,
  OrganizationEntityId,
  OrganizationLookup,
} from './types';

export async function collectOrganizationFolderHierarchy(
  context: CollectProjectAccessContext,
  options: {
    folderHierarchy: FolderHierarchy;
    organizationByIdLookup: OrganizationLookup;
  }
) {
  const { j1Client } = context;
  const j1ql = `
    FIND google_cloud_organization AS o
    THAT HAS >> google_cloud_folder AS f
    RETURN
      o._id,
      o.displayName,
      f._id,
      f.name
    `;

  type FolderEntityId = Opaque<string, 'FolderEntityId'>;
  type FolderProjectListData = {
    'o._id': OrganizationEntityId;
    'o.displayName'?: string;
    'f._id': FolderEntityId;
    'f.name'?: string;
  }[];

  const cursor = j1Client.executeJ1QL<FolderProjectListData>(context, {
    query: j1ql,
    variables: {},
    includeDeleted: false,
  });

  do {
    await context.j1qlWorkQueue.add(async () => {
      const page = await cursor.nextPage();
      if (page) {
        for (const item of page.data) {
          const folder =
            options.folderHierarchy.folderByEntityIdLookup[item['f._id']];
          const organization = options.organizationByIdLookup[item['o._id']];

          if (folder && organization) {
            folder.organization = organization;
            organization.childFolders.push(folder);
          } else {
            context.logger.warn(
              `Found reference to organization/folder relationship that was not collected previously. (folder._id=${item['f._id']}, organization._id=${item['o._id']})`
            );
          }
        }
      }
    });
  } while (cursor.hasNextPage());
}
