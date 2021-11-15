#/usr/bin/sh

mkdir -p ./work
npx get-graphql-schema \
  --header Content-Type="application/json" \
  --header "JupiterOne-Account=$( node ./tools/bin/j1-config-account-id.cjs )" \
  --header Authorization="Bearer $( node ./tools/bin/j1-config-api-key.cjs )" \
  "$( node ./tools/bin/j1-config-base-url.cjs )/graphql" > ./work/j1-schema.graphql