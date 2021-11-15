import {
  CollectProjectAccessContext,
  ProjectEntityId,
  ProjectGraphNode,
} from './types';

export async function collectProjects(context: CollectProjectAccessContext) {
  const { j1Client } = context;
  const j1ql = `
    FIND google_cloud_project AS p
    RETURN
      p._id,
      p._integrationInstanceId,
      p._integrationName,
      p.displayName,
      p.projectId
    `;

  const projectByIdLookup: Record<ProjectEntityId, ProjectGraphNode> = {};

  const cursor = j1Client.executeJ1QL<
    {
      'p._id': ProjectEntityId;
      'p._integrationInstanceId': string;
      'p._integrationName': string;
      'p.displayName'?: string;
      'p.projectId'?: string;
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
          const _id = item['p._id'];
          projectByIdLookup[_id] = {
            _id,
            _integrationInstanceId: item['p._integrationInstanceId'],
            _integrationName: item['p._integrationName'],
            displayName: item['p.displayName'],
            projectId: item['p.projectId'],
          };
        }
      }
    });
  } while (cursor.hasNextPage());

  return projectByIdLookup;
}
