import {
  CollectProjectAccessContext,
  OrganizationEntityId,
  OrganizationGraphNode,
} from './types';

export async function collectOrganizations(
  context: CollectProjectAccessContext
) {
  const { j1Client } = context;
  const j1ql = `
    FIND google_cloud_organization AS o
    RETURN
      o._id,
      o._integrationInstanceId,
      o._integrationName,
      o.displayName,
      o.name
    `;

  const organizationByIdLookup: Record<
    OrganizationEntityId,
    OrganizationGraphNode
  > = {};

  const cursor = j1Client.executeJ1QL<
    {
      'o._id': OrganizationEntityId;
      'o._integrationInstanceId': string;
      'o._integrationName': string;
      'o.displayName'?: string;
      'o.name'?: string;
    }[]
  >(context, {
    query: j1ql,
    variables: {},
    includeDeleted: false,
  });

  do {
    await context.j1qlWorkQueue.add(async () => {
      const page = await cursor.nextPage();
      if (page) {
        for (const item of page.data) {
          const _id = item['o._id'];
          organizationByIdLookup[_id] = {
            _id,
            _integrationInstanceId: item['o._integrationInstanceId'],
            _integrationName: item['o._integrationName'],
            displayName: item['o.displayName'],
            name: item['o.name'],
            childFolders: [],
            childProjects: [],
          };
        }
      }
    });
  } while (cursor.hasNextPage());

  return organizationByIdLookup;
}
