import { Opaque } from 'type-fest';
import {
  CollectProjectAccessContext,
  OrganizationEntityId,
  OrganizationLookup,
  ProjectLookup,
} from './types';

export async function collectOrganizationProjectHierarchy(
  context: CollectProjectAccessContext,
  options: {
    projectByIdLookup: ProjectLookup;
    organizationByIdLookup: OrganizationLookup;
  }
) {
  const { j1Client } = context;
  const j1ql = `
    FIND google_cloud_organization AS o
    THAT HAS >> google_cloud_project AS p
    RETURN
      o._id,
      o.displayName,
      p._id,
      p.projectId,
      p.displayName
    `;

  type ProjectEntityId = Opaque<string, 'ProjectEntityId'>;
  type ListData = {
    'o._id': OrganizationEntityId;
    'o.displayName'?: string;
    'p._id': ProjectEntityId;
    'p.projectId'?: string;
    'p.displayName'?: string;
  }[];

  const cursor = j1Client.executeJ1QL<ListData>(context, {
    query: j1ql,
    variables: {},
    includeDeleted: false,
  });

  do {
    await context.j1qlWorkQueue.add(async () => {
      const page = await cursor.nextPage();
      if (page) {
        for (const item of page.data) {
          const project = options.projectByIdLookup[item['p._id']];
          const organization = options.organizationByIdLookup[item['o._id']];

          if (project && organization) {
            project.parentOrganization = organization;
            organization.childProjects.push(project);
          } else {
            context.logger.warn(
              `Found reference to organization/project relationship that was not collected previously. (project._id=${item['p._id']}, organization._id=${item['o._id']})`
            );
          }
        }
      }
    });
  } while (cursor.hasNextPage());
}
