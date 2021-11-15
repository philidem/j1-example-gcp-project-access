FROM node:14-alpine as builder

COPY . /tmp/j1/gcp-project-access/

# Compile the TypeScript project
RUN cd /tmp/j1/gcp-project-access && yarn install && yarn build

# Install the production dependencies
RUN cd /tmp/j1/gcp-project-access/dist && yarn install --production

FROM node:14-alpine

COPY --from=builder /tmp/j1/gcp-project-access/dist/ /opt/j1/gcp-project-access

WORKDIR /opt/j1/gcp-project-access

ENTRYPOINT [ "node", "-r", "source-map-support/register", "/opt/j1/gcp-project-access/src/cli.js" ]
