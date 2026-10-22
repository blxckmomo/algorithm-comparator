export const pythonImplementations: Record<string, string> = {
  "linear-search": `def solve(data):
    arr = data["arr"]
    target = data["target"]
    for i, value in enumerate(arr):
        if value == target:
            return i
    return -1
`,
  "binary-search": `def solve(data):
    arr = data["arr"]
    target = data["target"]
    lo, hi = 0, len(arr)
    while lo < hi:
        mid = (lo + hi) // 2
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    if lo < len(arr) and arr[lo] == target:
        return lo
    return -1
`,
  "bubble-sort": `def solve(data):
    a = data["arr"]
    n = len(a)
    for end in range(n - 1, 0, -1):
        swapped = False
        for j in range(end):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True
        if not swapped:
            break
    return a
`,
  "insertion-sort": `def solve(data):
    a = data["arr"]
    for i in range(1, len(a)):
        value = a[i]
        j = i - 1
        while j >= 0 and a[j] > value:
            a[j + 1] = a[j]
            j -= 1
        a[j + 1] = value
    return a
`,
  "merge-sort": `def merge_sort(a):
    if len(a) <= 1:
        return list(a)
    mid = len(a) // 2
    left = merge_sort(a[:mid])
    right = merge_sort(a[mid:])
    merged = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            merged.append(left[i])
            i += 1
        else:
            merged.append(right[j])
            j += 1
    merged.extend(left[i:])
    merged.extend(right[j:])
    return merged

def solve(data):
    return merge_sort(data["arr"])
`,
  "quick-sort": `def quick_sort(a, lo, hi):
    if lo >= hi:
        return
    pivot = a[(lo + hi) // 2]
    i, j = lo, hi
    while i <= j:
        while a[i] < pivot:
            i += 1
        while a[j] > pivot:
            j -= 1
        if i <= j:
            a[i], a[j] = a[j], a[i]
            i += 1
            j -= 1
    quick_sort(a, lo, j)
    quick_sort(a, i, hi)

def solve(data):
    a = data["arr"]
    if a:
        quick_sort(a, 0, len(a) - 1)
    return a
`,
  bfs: `from collections import deque

def solve(data):
    adj = data["adj"]
    source = data["source"]
    seen = {source}
    queue = deque([source])
    order = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in adj[u]:
            if v not in seen:
                seen.add(v)
                queue.append(v)
    return order
`,
  dfs: `def solve(data):
    adj = data["adj"]
    source = data["source"]
    seen = set()
    order = []

    def visit(u):
        seen.add(u)
        order.append(u)
        for v in adj[u]:
            if v not in seen:
                visit(v)

    visit(source)
    return order
`,
  prim: `from heapq import heappush, heappop

def solve(data):
    n = data["v"]
    edges = data["edges"]
    start = data.get("start", 0)
    adj = [[] for _ in range(n)]
    for u, v, w in edges:
        adj[u].append((v, w))
        adj[v].append((u, w))
    in_tree = [False] * n
    heap = [(0, start)]
    total = 0
    visited = 0
    while heap:
        w, u = heappop(heap)
        if in_tree[u]:
            continue
        in_tree[u] = True
        total += w
        visited += 1
        for v, weight in adj[u]:
            if not in_tree[v]:
                heappush(heap, (weight, v))
    if visited != n:
        raise ValueError("graph must be connected")
    return total
`,
  kruskal: `def solve(data):
    n = data["v"]
    edges = data["edges"]
    parent = list(range(n))
    size = [1] * n

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    total = 0
    used = 0
    for u, v, w in sorted(edges, key=lambda edge: edge[2]):
        ru, rv = find(u), find(v)
        if ru == rv:
            continue
        if size[ru] < size[rv]:
            ru, rv = rv, ru
        parent[rv] = ru
        size[ru] += size[rv]
        total += w
        used += 1
        if used == n - 1:
            break
    if used != n - 1:
        raise ValueError("graph must be connected")
    return total
`,
};
