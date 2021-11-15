import chalk from 'chalk';
import {
  CollectProjectAccessOutput,
  FolderGraphNode,
  IamBindingOtherEntityType,
  ProjectGraphNode,
} from './collect/types';
import { LoggerContext } from './context';

export function printReport(
  context: LoggerContext,
  output: CollectProjectAccessOutput
) {
  const {
    folderHierarchy,
    organizationByIdLookup,
    projectByIdLookup,
    iamBindingLookup,
  } = output;

  const printGraphObjectHelper = (
    graphObject: {
      _id: string;
      displayName?: string;
      childProjects?: ProjectGraphNode[];
      childFolders?: FolderGraphNode[];
    },
    depth: number,
    type: 'Project' | 'Folder' | 'Organization',
    printProjects: boolean
  ) => {
    for (let i = 0; i < depth; i++) {
      process.stdout.write('  ');
    }
    console.log(
      `- ${chalk.gray(type)}: ${chalk.bold(graphObject.displayName)} (${
        graphObject._id
      })`
    );

    if (printProjects && graphObject.childProjects) {
      for (const child of graphObject.childProjects) {
        printGraphObjectHelper(child, depth + 1, 'Project', printProjects);
      }
    }

    if (graphObject.childFolders) {
      for (const child of graphObject.childFolders) {
        printGraphObjectHelper(child, depth + 1, 'Folder', printProjects);
      }
    }
  };

  console.log(chalk.bold('\nFOLDERS:'));
  for (const folder of folderHierarchy.rootFolders) {
    printGraphObjectHelper(folder, 0, 'Folder', false);
  }

  console.log(chalk.bold('\nORGANIZATIONS:'));
  for (const organization of Object.values(organizationByIdLookup)) {
    console.log(`- ${organization.displayName} (_id=${organization._id})`);
  }

  console.log(chalk.bold('\nPROJECTS:'));
  for (const project of Object.values(projectByIdLookup)) {
    console.log(`- ${project.displayName} (_id=${project._id})`);
  }

  console.log(chalk.bold('\nPROJECT HIERARCHY:'));

  for (const organization of Object.values(organizationByIdLookup)) {
    printGraphObjectHelper(organization, 0, 'Organization', true);
  }

  console.log(chalk.bold('\nIAM BINDINGS:'));

  const relatedEntityTypes: {
    entityType: IamBindingOtherEntityType;
    entities: {
      _id: string;
      displayName?: string;
    }[];
  }[] = [
    {
      entityType: 'google_cloud_organization',
      entities: Object.values(organizationByIdLookup),
    },
    {
      entityType: 'google_cloud_folder',
      entities: Object.values(folderHierarchy.folderByEntityIdLookup),
    },
    {
      entityType: 'google_cloud_project',
      entities: Object.values(projectByIdLookup),
    },
  ];

  for (const related of relatedEntityTypes) {
    console.log(chalk.bold.yellow(`\n  by ${related.entityType}:`));
    for (const entity of related.entities) {
      console.log(
        `\n    ${chalk.bold.cyan(entity.displayName)} (_id=${entity._id})`
      );
      const bindings = iamBindingLookup[related.entityType][entity._id];
      if (bindings?.length) {
        for (let i = 0; i < bindings.length; i++) {
          const binding = bindings[i];
          console.log(chalk.bold.gray(`\n      IAM BINDING #${i + 1}:`));

          console.log(chalk.bold('\n        MEMBERS:'));
          for (const member of binding.members) {
            console.log(`        - ${member}`);
          }

          console.log(chalk.bold('\n        ROLE:'));
          console.log(`        - ${binding.role}`);
        }
      } else {
        console.log(chalk.gray('      (no IAM bindings)'));
      }
    }
  }
}
