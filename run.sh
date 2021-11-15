#!/bin/sh -e

yarn compile
node -r source-map-support/register ./dist/src/cli $@