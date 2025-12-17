#!/bin/bash
# Script to set git SHA environment variables for build

# Get current repository git SHA
if [ -d .git ] || git rev-parse --git-dir > /dev/null 2>&1; then
  export REACT_APP_GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo '')
else
  export REACT_APP_GIT_SHA=''
fi

# Get dicom-microscopy-viewer git SHA
if [ -d ../dicom-microscopy-viewer/.git ] || (cd ../dicom-microscopy-viewer && git rev-parse --git-dir > /dev/null 2>&1); then
  export REACT_APP_DMV_GIT_SHA=$(cd ../dicom-microscopy-viewer && git rev-parse HEAD 2>/dev/null || echo '')
else
  export REACT_APP_DMV_GIT_SHA=''
fi

# Execute the command passed as arguments
exec "$@"

