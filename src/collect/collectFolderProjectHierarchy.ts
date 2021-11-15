import { Opaque } from 'type-fest';
import {
  CollectProjectAccessContext,
  FolderHierarchy,
  ProjectEntityId,
  ProjectLookup,
} from './types';

export async function collectFolderProjectHierarchy(
  context: CollectProjectAccessContext,
  options: {
    folderHierarchy: FolderHierarchy;
    projectByIdLookup: ProjectLookup;
  }
) {
  const { j1Client } = context;
  const j1ql = `
    FIND google_cloud_folder AS f
    THAT HAS >> google_cloud_project AS p
    RETURN
      f._id,
      f.name,
      p._id,
      p.projectId,
      p.displayName
    `;

  type FolderEntityId = Opaque<string, 'FolderEntityId'>;
  type FolderProjectListData = {
    'f._id': FolderEntityId;
    'f.name'?: string;
    'p._id': ProjectEntityId;
    'p.projectId'?: string;
    'p.displayName'?: string;
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
          const project = options.projectByIdLookup[item['p._id']];

          if (folder && project) {
            project.parentFolder = folder;
            folder.childProjects.push(project);
          } else {
            context.logger.warn(
              `Found reference to folder/project relationship that was not collected previously. (folder._id=${item['f._id']}, project._id=${item['p._id']})`
            );
          }
        }
      }
    });
  } while (cursor.hasNextPage());
}
