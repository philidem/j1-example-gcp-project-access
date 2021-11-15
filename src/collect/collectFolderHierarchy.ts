import { Opaque } from 'type-fest';
import {
  CollectProjectAccessContext,
  FolderEntityId,
  FolderGraphNode,
  FolderHierarchy,
} from './types';

export async function collectFolderHierarchy(
  context: CollectProjectAccessContext
): Promise<FolderHierarchy> {
  const folderByGraphObjectIdLookup: Record<
    FolderGraphObjectId,
    FolderGraphNode | undefined
  > = {};
  const folderByEntityIdLookup: Record<FolderEntityId, FolderGraphNode> = {};

  const { j1Client } = context;
  const j1ql = `
    FIND google_cloud_folder AS parent
    (THAT HAS >> AS rel google_cloud_folder)? AS child
    RETURN TREE
    `;

  type FolderGraphObjectId = Opaque<string, 'FolderGraphObjectId'>;

  type FolderHierarchyTreeData = {
    vertices: [
      {
        id: FolderGraphObjectId;
        entity: {
          _id: FolderEntityId;
          _integrationInstanceId: string;
          displayName: string;
        };
        properties: {
          name: string;
          parent: string;
        };
      }
    ];
    edges: [
      {
        id: string;
        fromVertexId: FolderGraphObjectId;
        toVertexId: FolderGraphObjectId;
      }
    ];
  };

  const cursor = j1Client.executeJ1QL<FolderHierarchyTreeData>(context, {
    query: j1ql,
    variables: {},
    includeDeleted: false,
  });

  do {
    await context.j1qlWorkQueue.add(async () => {
      const page = await cursor.nextPage();
      if (page) {
        for (const vertex of page.data.vertices) {
          const folder: FolderGraphNode = {
            _id: vertex.entity._id,
            name: vertex.properties.name,
            displayName: vertex.entity.displayName,
            childFolders: [],
            childProjects: [],
          };
          folderByEntityIdLookup[vertex.entity._id] = folder;
          folderByGraphObjectIdLookup[vertex.id] = folder;
        }

        for (const edge of page.data.edges) {
          const parentFolder = folderByGraphObjectIdLookup[edge.fromVertexId];
          const childFolder = folderByGraphObjectIdLookup[edge.toVertexId];
          if (parentFolder && childFolder) {
            childFolder.parentFolder = parentFolder;
            parentFolder.childFolders.push(childFolder);
          } else {
            context.logger.warn('Edge did not reference known folders');
          }
        }
      }
    });
  } while (cursor.hasNextPage());

  const rootFolders: FolderGraphNode[] = [];
  for (const value of Object.values(folderByEntityIdLookup)) {
    if (!value.parentFolder) {
      rootFolders.push(value);
    }
  }
  return {
    rootFolders,
    folderByEntityIdLookup,
  };
}
