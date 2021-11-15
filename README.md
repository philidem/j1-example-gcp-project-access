# JupiterOne example for analyzing Google Cloud Project access

This sample program executes multiple [JupiterOne](https://jupiterone.com/)
queries to collect enough information to determine effective access to each
Google Cloud Project. This program finds all of the ancestor folders
and organizations associated with each project. The IAM bindings at the
project, folder, and organization level are used to compute the consolidated
list of IAM bindings associated with each binding.

## Prerequisites

- Clone this repo via
  `git clone git@github.com:philidem/j1-example-gcp-project-access.git`

- Change working directory to the git repo that was just cloned.

- Create a `.env` project in your current directory with the following content:

```ini
J1_BASE_URL = https://api.us.jupiterone.io
J1_ACCOUNT_ID = INSERT_YOUR_J1_ACCOUNT_ID_HERE
J1_API_KEY = INSERT_YOUR_J1_API_KEY_HERE
```

## How to run from source code with Docker

- Run the following commend to build with Docker:

```sh
docker build -f Dockerfile -t j1-example-gcp-project-access .
```

- Run the command using the docker image you just build:

```sh
docker run --rm -it -w `pwd` -v `pwd`:`pwd` j1-example-gcp-project-access
```

By default the output will be written to `gcp-project-access.json` in the
current working directory.

## How to run from source code with Node.js runtime

- Install [node](https://nodejs.org) and [yarn](https://yarnpkg.com/).

- Compile the project

```sh
yarn compile
```

- Run the command:

```sh
node -r source-map-support/register ./dist/src/cli
```

## Example usage

**NOTE:** Adjust the examples below to use the locally built docker image or the
compiled JavaScript code.

**Print help for command:**

```sh
j1-example-gcp-project-access --help
```

**Run and only include IAM bindings with given roles:**

```sh
j1-example-gcp-project-access \
  --role roles/owner \
  --role roles/resourcemanager.organizationAdmin
```

**Run but do not include the permissions in the IAM bindings:**

Excluding permissions will improve performance and is helpful if you only
need the roles.

```sh
j1-example-gcp-project-access --no-permissions
```

**Run and print detailed report:**

```sh
j1-example-gcp-project-access \
  --role roles/owner \
  --role roles/resourcemanager.organizationAdmin \
  --report
```

## Overall flow

**Fetch all of the IAM binding relationships associated with organization:**

Find all of the bindings related to organization (we only need to collect the
`_id` to build the relationships).

```j1ql
FIND google_iam_binding AS b
  THAT ALLOWS >> google_cloud_organization AS o
  RETURN
    b._id,
    b.members,
    b.permissions,
    b.role,
    o._id
```

**Fetch all of the IAM binding relationships associated with folders:**

Find all of the bindings related to folder (we only need to collect the `_id` to
build the relationships).

```j1ql
FIND google_iam_binding AS b
  THAT ALLOWS >> google_cloud_folder AS o
  RETURN
    b._id,
    b.members,
    b.permissions,
    b.role,
    o._id
```

**Fetch all of the IAM binding relationships associated with project:**

Find all of the bindings related to project (we only need to collect the `_id`
to build the relationships).

```j1ql
FIND google_iam_binding AS b
  THAT ALLOWS >> google_cloud_project AS o
  RETURN
    b._id,
    b.members,
    b.permissions,
    b.role,
    o._id
```

**Fetch the folder hiearchy:**

Fetch the folder hierarchy so that we can walk up the tree from project.

```j1ql
FIND google_cloud_folder AS parent
  (THAT HAS >> AS rel google_cloud_folder)? AS child
  RETURN TREE
```

**Fetch all of the projects:**

```j1ql
FIND google_cloud_project AS p
  RETURN
    p._id,
    p._integrationInstanceId,
    p._integrationName,
    p.displayName,
    p.projectId
```

**Fetch all of the organizations:**

```j1ql
FIND google_cloud_organization AS o
  RETURN
    o._id,
    o._integrationInstanceId,
    o._integrationName,
    o.displayName,
    o.name
```

**Fetch the organization/folder hierarchy:**

```j1ql
FIND google_cloud_organization AS o
  THAT HAS >> google_cloud_folder AS f
  RETURN
    o._id,
    o.displayName,
    f._id,
    f.name
```

**Fetch the folder/project hierarchy:**

```j1ql
FIND google_cloud_folder AS f
  THAT HAS >> google_cloud_project AS p
  RETURN
    f._id,
    f.name,
    p._id,
    p.projectId,
    p.displayName
```

**After all of the prerequisite data is fetched:**

- Build an in-memory graph that allows you to easily determine the organization
  and all parent folders associated with a `google_cloud_project`.
- Store an in-memory lookup table of the `google_iam_binding` entities for each
  `google_cloud_organization`, `google_cloud_folder`, and `google_cloud_project`

For each `google_cloud_project`:

- Find all IAM bindings associated with folders for given project
- Find all IAM bindings associated with organization for given project
- Find all IAM bindings associated directly with project
