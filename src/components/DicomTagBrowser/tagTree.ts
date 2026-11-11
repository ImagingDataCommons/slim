import type { TagInfo } from './tagRows'

export interface TagTreeNode {
  key: string
  tag: string
  vr: string
  keyword: string
  value: string
  children?: TagTreeNode[]
}

/** Tag rows with keys unique along the sequence path, e.g. "00400560-1-0040A043" */
export function buildTagTree(tags: TagInfo[], parentKey = ''): TagTreeNode[] {
  return tags.map((tag, index) => {
    const keyBase = tag.tag !== '' ? tag.tag.replace(/[(),]/g, '') : `${index}`
    const key = parentKey !== '' ? `${parentKey}-${keyBase}` : keyBase
    const node: TagTreeNode = {
      key,
      tag: tag.tag,
      vr: tag.vr,
      keyword: tag.keyword,
      value: tag.value,
    }
    if (tag.children !== undefined && tag.children.length > 0) {
      node.children = buildTagTree(tag.children, key)
    }
    return node
  })
}

function nodeMatches(node: TagTreeNode, query: string): boolean {
  return [node.tag, node.vr, node.keyword, node.value].some((field) =>
    (field ?? '').toString().toLowerCase().includes(query),
  )
}

/**
 * Keeps matching nodes and their ancestors. A matching node without matching
 * descendants keeps all of its children. `matchedKeys` lists every kept
 * ancestor/match so callers can expand the paths to the matches.
 */
export function filterTagTree(
  data: TagTreeNode[],
  query: string,
): { tree: TagTreeNode[]; matchedKeys: Set<string> } {
  const matchedKeys = new Set<string>()
  const normalized = query.trim().toLowerCase()
  if (normalized === '') return { tree: data, matchedKeys }

  const filterNodes = (nodes: TagTreeNode[]): TagTreeNode[] =>
    nodes.flatMap((node): TagTreeNode[] => {
      const children =
        node.children !== undefined ? filterNodes(node.children) : []
      if (children.length > 0) {
        matchedKeys.add(node.key)
        return [{ ...node, children }]
      }
      if (nodeMatches(node, normalized)) {
        matchedKeys.add(node.key)
        return [node]
      }
      return []
    })

  return { tree: filterNodes(data), matchedKeys }
}

export function collectExpandableKeys(items: TagTreeNode[]): string[] {
  return items.flatMap((item) =>
    item.children !== undefined && item.children.length > 0
      ? [item.key, ...collectExpandableKeys(item.children)]
      : [],
  )
}

/** Number of rendered rows given the expanded sequence keys */
export function countRows(
  items: TagTreeNode[],
  expandedKeys: ReadonlySet<string>,
): number {
  return items.reduce(
    (total, item) =>
      total +
      1 +
      (item.children !== undefined && expandedKeys.has(item.key)
        ? countRows(item.children, expandedKeys)
        : 0),
    0,
  )
}
