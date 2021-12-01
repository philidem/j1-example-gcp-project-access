import {
  CollectProjectAccessContext,
  IamBindingEntityId,
  IamBindingOtherEntityType,
} from './types';

export async function collectIamBindingRelationhipsForType(
  context: CollectProjectAccessContext,
  options: {
    includePermissions: boolean;
    otherEntityType: IamBindingOtherEntityType;
    each: (item: {
      _id: IamBindingEntityId;
      members: string[];
      role: string | undefined;
      permissions: string[];
      otherEntityId: string;
    }) => void;
  }
) {
  const { j1Client } = context;
  const j1ql = `
    FIND google_iam_binding AS b
    THAT (ALLOWS|HAS) >> ${options.otherEntityType} AS o
    RETURN
      b._id,
      b.members,
      ${options.includePermissions ? 'b.permissions,' : ''}
      b.role,
      o._id
    `;

  const cursor = j1Client.executeJ1QL<
    {
      'b._id': IamBindingEntityId;
      'b.members'?: string | string[];
      'b.permissions'?: string | string[];
      'b.role'?: string;
      'o._id': string;
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
          const members = item['b.members'];
          const permissions = item['b.permissions'];

          options.each({
            _id: item['b._id'],
            members: members
              ? Array.isArray(members)
                ? members
                : [members]
              : [],
            permissions: permissions
              ? Array.isArray(permissions)
                ? permissions
                : [permissions]
              : [],
            role: item['b.role'],
            otherEntityId: item['o._id'],
          });
        }
      }
    });
  } while (cursor.hasNextPage());
}
