import PQueue from 'p-queue';
import { LoggerContext } from '~/src/context';
import { JupiterOneClient } from '~/src/j1Client/types';
import { buildConsolidatedProjectAccess } from './buildConsolidatedProjectAccess';
import { collectFolderHierarchy } from './collectFolderHierarchy';
import { collectFolderProjectHierarchy } from './collectFolderProjectHierarchy';
import { collectIamBindingRelationships } from './collectIamBindingRelationships';
import { collectOrganizationFolderHierarchy } from './collectOrganizationFolderHierarchy';
import { collectOrganizationProjectHierarchy } from './collectOrganizationProjectHierarchy';
import { collectOrganizations } from './collectOrganizations';
import { collectProjects } from './collectProjects';
import {
  CollectProjectAccessContext,
  FolderHierarchy,
  IamBindingLookup,
  OrganizationLookup,
  ProjectLookup,
} from './types';

export async function collectProjectAccess(
  parentContext: LoggerContext,
  options: {
    j1Client: JupiterOneClient;
    j1qlWorkQueue: PQueue;
    j1qlConcurrency: number;
    filterByRole: Set<string>;
    includePermissions: boolean;
  }
) {
  const context: CollectProjectAccessContext = {
    ...parentContext,
    j1Client: options.j1Client,
    j1qlWorkQueue: options.j1qlWorkQueue,
  };

  const { logger } = context;

  const workQueue = new PQueue();

  const errors: Error[] = [];

  const errorHandler = (err: Error) => {
    errors.push(err);
  };

  const checkForErrors = () => {
    if (errors.length) {
      throw new Error(
        `Errors occurred:\n${errors
          .map((err) => {
            return `\n ${err.toString()}\n`;
          })
          .join('')}`
      );
    }
  };

  let folderHierarchy: FolderHierarchy | undefined;
  let projectByIdLookup: ProjectLookup | undefined;
  let organizationByIdLookup: OrganizationLookup | undefined;
  let iamBindingLookup: IamBindingLookup | undefined;

  /**
   * Collect the following relationships:
   *
   * google_iam_binding
   * ALLOWS (
   *  google_cloud_organization|
   *  google_cloud_folder|
   *  google_cloud_project
   * )
   */
  workQueue
    .add(async () => {
      iamBindingLookup = await collectIamBindingRelationships(context, {
        includePermissions: options.includePermissions
      });
      logger.info(
        {
          folderBindingCount: Object.values(
            iamBindingLookup.google_cloud_folder
          ).length,
          projectBindingCount: Object.values(
            iamBindingLookup.google_cloud_project
          ).length,
          organizationBindingCount: Object.values(
            iamBindingLookup.google_cloud_organization
          ).length,
        },
        'Collected all IAM bindings'
      );
    })
    .catch(errorHandler);

  /**
   * Collect the entire google_cloud_folder hierarchy (just the folders
   * and their parent/child relationships)
   */
  workQueue
    .add(async () => {
      folderHierarchy = await collectFolderHierarchy(context);
      logger.info(
        {
          count: Object.values(folderHierarchy.folderByEntityIdLookup).length,
        },
        'Collected all folders'
      );
    })
    .catch(errorHandler);

  /**
   * Collect all of the google_cloud_project entities
   */
  workQueue
    .add(async () => {
      projectByIdLookup = await collectProjects(context);
      logger.info(
        {
          count: Object.values(projectByIdLookup).length,
        },
        'Collected all projects'
      );
    })
    .catch(errorHandler);

  /**
   * Collect all of the google_cloud_organization entities
   */
  workQueue
    .add(async () => {
      organizationByIdLookup = await collectOrganizations(context);
      logger.info(
        {
          count: Object.values(organizationByIdLookup).length,
        },
        'Collected all organizations'
      );
    })
    .catch(errorHandler);

  await workQueue.onIdle();

  checkForErrors();

  if (!folderHierarchy) {
    throw new Error('"folderHierarchy" not collected');
  }

  if (!projectByIdLookup) {
    throw new Error('"projectByIdLookup" not collected');
  }

  if (!organizationByIdLookup) {
    throw new Error('"organizationByIdLookup" not collected');
  }

  if (!iamBindingLookup) {
    throw new Error('"iamBindingLookup" not collected');
  }

  /**
   * Build the project/folder hierarchy
   */
  workQueue
    .add(async () => {
      await collectFolderProjectHierarchy(context, {
        folderHierarchy: folderHierarchy!,
        projectByIdLookup: projectByIdLookup!,
      });
    })
    .catch(errorHandler);

  /**
   * Build the organization/folder hierarchy
   */
  workQueue
    .add(async () => {
      await collectOrganizationFolderHierarchy(context, {
        folderHierarchy: folderHierarchy!,
        organizationByIdLookup: organizationByIdLookup!,
      });
    })
    .catch(errorHandler);

  /**
   * Build the organization/project hierarchy
   */
  workQueue
    .add(async () => {
      await collectOrganizationProjectHierarchy(context, {
        projectByIdLookup: projectByIdLookup!,
        organizationByIdLookup: organizationByIdLookup!,
      });
    })
    .catch(errorHandler);

  await workQueue.onIdle();

  checkForErrors();

  return buildConsolidatedProjectAccess({
    folderHierarchy,
    projectByIdLookup,
    organizationByIdLookup,
    iamBindingLookup,
    filterByRole: options.filterByRole,
  });
}
