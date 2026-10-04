#!/bin/sh
set -e
# The ./data bind mount is often created by Docker as root. Fix ownership, then drop to the unprivileged node user.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${DATA_DIR:-/data}"
  chown -R node:node "${DATA_DIR:-/data}"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
