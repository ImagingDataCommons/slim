#!/usr/bin/env bash
set -euo pipefail

DMV_REPO='https://github.com/ImagingDataCommons/dicom-microscopy-viewer.git'
DMV_REPO_SLUG='ImagingDataCommons/dicom-microscopy-viewer'

is_safe_ref() {
  case "$1" in
    ''|*[!A-Za-z0-9._/-]*|.*|*.) return 1 ;;
    *) return 0 ;;
  esac
}

# Check if there's an open PR for a branch in DMV repo.
# Returns 0 (true) if an open PR exists, 1 (false) otherwise.
has_open_pr() {
  local branch="$1"
  local count
  count="$(gh pr list --repo "${DMV_REPO_SLUG}" --head "${branch}" --state open --json number --jq 'length' 2>/dev/null || echo 0)"
  [ "${count}" -gt 0 ]
}

# Strip HTML comments so PR-template examples cannot be parsed as values.
BODY_NO_COMMENTS="$(python3 -c 'import os,re; print(re.sub(r"<!--.*?-->", "", os.environ.get("PR_BODY", ""), flags=re.S))')"

# Prefer explicit "dmv-branch: <name>" from the PR body; else same-name branch.
EXPLICIT=""
while IFS= read -r line || [ -n "${line}" ]; do
  case "${line}" in
    dmv-branch:*)
      val="${line#dmv-branch:}"
      val="$(printf '%s' "${val}" | tr -d '[:space:]')"
      if [ -n "${val}" ]; then
        EXPLICIT="${val}"
      fi
      ;;
  esac
done < <(printf '%s\n' "${BODY_NO_COMMENTS}" | sed -nE 's/^[[:space:]]*(dmv-branch:.*)$/\1/p')

if [ -n "${EXPLICIT}" ]; then
  BRANCH="${EXPLICIT}"
  SOURCE='dmv-branch'
else
  BRANCH="${HEAD_REF}"
  SOURCE='matching-branch'
fi

if ! is_safe_ref "${BRANCH}"; then
  echo "::error::Unsafe DMV branch ref rejected: ${BRANCH}"
  exit 1
fi

SHA="$(git ls-remote --heads "${DMV_REPO}" "refs/heads/${BRANCH}" | awk '{print $1}')"
if [ -n "${SHA}" ]; then
  case "${SHA}" in
    *[!0-9a-fA-F]*|'' ) echo "::error::Unexpected git SHA from ls-remote"; exit 1 ;;
  esac

  # For matching branches (not explicit dmv-branch:), require an open PR in DMV.
  # This prevents picking up stale/merged branches that weren't deleted.
  if [ "${SOURCE}" = "matching-branch" ] && ! has_open_pr "${BRANCH}"; then
    echo "Matching DMV branch '${BRANCH}' exists but has no open PR; using package.json pin"
    echo "use_git=false" >> "${GITHUB_OUTPUT}"
  else
    echo "Using DMV branch '${BRANCH}' (${SOURCE}) at ${SHA}"
    {
      echo "use_git=true"
      echo "ref=${BRANCH}"
      echo "sha=${SHA}"
      echo "source=${SOURCE}"
    } >> "${GITHUB_OUTPUT}"
  fi
elif [ -n "${EXPLICIT}" ]; then
  echo "::error::dmv-branch '${EXPLICIT}' was set in the PR body but was not found on dicom-microscopy-viewer"
  exit 1
else
  echo "No matching DMV branch '${BRANCH}'; using package.json pin"
  echo "use_git=false" >> "${GITHUB_OUTPUT}"
fi
