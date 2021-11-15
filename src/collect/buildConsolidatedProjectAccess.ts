import {
  FolderHierarchy,
  IamBinding,
  IamBindingLookup,
  IamBindingOtherEntityType,
  OrganizationLookup,
  ProjectAccess,
  ProjectLookup,
} from './types';

export function buildConsolidatedProjectAccess(options: {
  folderHierarchy: FolderHierarchy;
  projectByIdLookup: ProjectLookup;
  organizationByIdLookup: OrganizationLookup;
  iamBindingLookup: IamBindingLookup;
  filterByRole: Set<string> | undefined;
}) {
  const projects: ProjectAccess[] = [];
  for (const project of Object.values(options.projectByIdLookup)) {
    let consolidatedBindings: IamBinding[] = [];

    const addBindingsHelper = (
      otherEntityType: IamBindingOtherEntityType,
      otherEntityId: string | undefined
    ) => {
      if (otherEntityId) {
        let bindingsForOther =
          options.iamBindingLookup[otherEntityType][otherEntityId];
        if (bindingsForOther) {
          const { filterByRole } = options;
          if (filterByRole?.size) {
            // Apply filtering
            bindingsForOther = bindingsForOther.filter((binding) => {
              const actualRole = binding.role;
              return actualRole && filterByRole.has(actualRole);
            });
          }
          consolidatedBindings = consolidatedBindings.concat(bindingsForOther);
        }
      }
    };

    addBindingsHelper('google_cloud_project', project._id);

    let folder = project.parentFolder;
    while (folder) {
      addBindingsHelper('google_cloud_folder', folder._id);
      addBindingsHelper('google_cloud_organization', folder.organization?._id);
      folder = folder.parentFolder;
    }

    addBindingsHelper(
      'google_cloud_organization',
      project.parentOrganization?._id
    );

    projects.push({
      _id: project._id,
      _integrationInstanceId: project._integrationInstanceId,
      _integrationName: project._integrationName,
      iamBindings: consolidatedBindings,
      displayName: project.displayName,
      projectId: project.projectId,
      organizationName: project.parentOrganization?.name,
      organizationDisplayName: project.parentOrganization?.displayName,
      folderName: project.parentFolder?.name,
      folderDisplayName: project.parentFolder?.displayName,
    });
  }

  return {
    ...options,
    projects,
  };
}
