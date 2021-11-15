import pMap from 'p-map';
import { collectIamBindingRelationhipsForType } from './collectIamBindingRelationhipsForType';
import {
  CollectProjectAccessContext,
  IamBindingLookup,
  IamBindingOtherEntityType,
} from './types';

export async function collectIamBindingRelationships(
  context: CollectProjectAccessContext
) {
  const otherEntityTypes: IamBindingOtherEntityType[] = [
    'google_cloud_organization',
    'google_cloud_folder',
    'google_cloud_project',
  ];

  const lookup: IamBindingLookup = {
    /**
     * Lookup for finding the bindings associated with each organization
     */
    google_cloud_organization: {},

    /**
     * Lookup for finding the bindings associated with each folder
     */
    google_cloud_folder: {},

    /**
     * Lookup for finding the bindings associated with each project
     */
    google_cloud_project: {},
  };

  await pMap(otherEntityTypes, async (otherEntityType) => {
    await collectIamBindingRelationhipsForType(context, {
      otherEntityType,
      each(item) {
        const lookupForType = lookup[otherEntityType];
        const related =
          lookupForType[item.otherEntityId] ??
          (lookupForType[item.otherEntityId] = []);
        related.push({
          _id: item._id,
          members: item.members,
          permissions: item.permissions,
          role: item.role,
        });
      },
    });
  });

  return lookup;
}
