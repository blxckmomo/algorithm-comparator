export const cppImplementations: Record<string, string> = {
  "linear-search": `Json solve(Json& data) {
    const auto& a = data.at("arr").array();
    long long target = data.at("target").integer();
    for (long long i = 0; i < (long long)a.size(); ++i) {
        if (a[i].integer() == target) return Json(i);
    }
    return Json(-1LL);
}
`,
  "binary-search": `Json solve(Json& data) {
    const auto& a = data.at("arr").array();
    long long target = data.at("target").integer();
    long long lo = 0, hi = (long long)a.size();
    while (lo < hi) {
        long long mid = (lo + hi) / 2;
        if (a[mid].integer() < target) lo = mid + 1;
        else hi = mid;
    }
    if (lo < (long long)a.size() && a[lo].integer() == target) return Json(lo);
    return Json(-1LL);
}
`,
  "bubble-sort": `Json solve(Json& data) {
    auto& a = data.at("arr").array();
    for (long long end = (long long)a.size() - 1; end > 0; --end) {
        bool swapped = false;
        for (long long j = 0; j < end; ++j) {
            if (a[j].integer() > a[j + 1].integer()) {
                std::swap(a[j], a[j + 1]);
                swapped = true;
            }
        }
        if (!swapped) break;
    }
    return data.at("arr");
}
`,
  "insertion-sort": `Json solve(Json& data) {
    auto& a = data.at("arr").array();
    for (long long i = 1; i < (long long)a.size(); ++i) {
        long long value = a[i].integer();
        long long j = i - 1;
        while (j >= 0 && a[j].integer() > value) {
            a[j + 1] = a[j];
            --j;
        }
        a[j + 1] = Json(value);
    }
    return data.at("arr");
}
`,
  "merge-sort": `std::vector<long long> merge_sort(const std::vector<long long>& a) {
    if (a.size() <= 1) return a;
    long long mid = (long long)a.size() / 2;
    std::vector<long long> left(a.begin(), a.begin() + mid);
    std::vector<long long> right(a.begin() + mid, a.end());
    left = merge_sort(left);
    right = merge_sort(right);
    std::vector<long long> merged;
    merged.reserve(a.size());
    std::size_t i = 0, j = 0;
    while (i < left.size() && j < right.size()) {
        if (left[i] <= right[j]) merged.push_back(left[i++]);
        else merged.push_back(right[j++]);
    }
    while (i < left.size()) merged.push_back(left[i++]);
    while (j < right.size()) merged.push_back(right[j++]);
    return merged;
}

Json solve(Json& data) {
    std::vector<long long> a;
    for (const auto& x : data.at("arr").array()) a.push_back(x.integer());
    return Json(merge_sort(a));
}
`,
  "quick-sort": `void quick_sort(std::vector<Json>& a, long long lo, long long hi) {
    if (lo >= hi) return;
    long long pivot = a[(lo + hi) / 2].integer();
    long long i = lo, j = hi;
    while (i <= j) {
        while (a[i].integer() < pivot) ++i;
        while (a[j].integer() > pivot) --j;
        if (i <= j) {
            std::swap(a[i], a[j]);
            ++i;
            --j;
        }
    }
    quick_sort(a, lo, j);
    quick_sort(a, i, hi);
}

Json solve(Json& data) {
    auto& a = data.at("arr").array();
    if (!a.empty()) quick_sort(a, 0, (long long)a.size() - 1);
    return data.at("arr");
}
`,
  bfs: `Json solve(Json& data) {
    const auto& adj = data.at("adj").array();
    long long source = data.at("source").integer();
    std::vector<char> seen(adj.size(), 0);
    std::queue<long long> queue;
    std::vector<long long> order;
    seen[source] = 1;
    queue.push(source);
    while (!queue.empty()) {
        long long u = queue.front();
        queue.pop();
        order.push_back(u);
        for (const auto& item : adj[u].array()) {
            long long v = item.integer();
            if (!seen[v]) {
                seen[v] = 1;
                queue.push(v);
            }
        }
    }
    return Json(order);
}
`,
  dfs: `void dfs_visit(long long u, const std::vector<Json>& adj,
               std::vector<char>& seen, std::vector<long long>& order) {
    seen[u] = 1;
    order.push_back(u);
    for (const auto& item : adj[u].array()) {
        long long v = item.integer();
        if (!seen[v]) dfs_visit(v, adj, seen, order);
    }
}

Json solve(Json& data) {
    const auto& adj = data.at("adj").array();
    long long source = data.at("source").integer();
    std::vector<char> seen(adj.size(), 0);
    std::vector<long long> order;
    dfs_visit(source, adj, seen, order);
    return Json(order);
}
`,
  prim: `struct PrimEdge {
    long long to;
    long long weight;
};

Json solve(Json& data) {
    long long n = data.at("v").integer();
    long long start = data.object().count("start") ? data.at("start").integer() : 0;
    std::vector<std::vector<PrimEdge>> adj(n);
    for (const auto& item : data.at("edges").array()) {
        const auto& e = item.array();
        long long u = e[0].integer(), v = e[1].integer(), w = e[2].integer();
        adj[u].push_back({v, w});
        adj[v].push_back({u, w});
    }
    using Entry = std::pair<long long, long long>;
    std::priority_queue<Entry, std::vector<Entry>, std::greater<Entry>> heap;
    std::vector<char> in_tree(n, 0);
    heap.push({0, start});
    long long total = 0, visited = 0;
    while (!heap.empty()) {
        auto [w, u] = heap.top();
        heap.pop();
        if (in_tree[u]) continue;
        in_tree[u] = 1;
        total += w;
        ++visited;
        for (const auto& edge : adj[u]) {
            if (!in_tree[edge.to]) heap.push({edge.weight, edge.to});
        }
    }
    if (visited != n) throw std::runtime_error("graph must be connected");
    return Json(total);
}
`,
  kruskal: `struct KruskalEdge {
    long long u, v, w;
};

long long kruskal_find(std::vector<long long>& parent, long long x) {
    if (parent[x] != x) parent[x] = kruskal_find(parent, parent[x]);
    return parent[x];
}

Json solve(Json& data) {
    long long n = data.at("v").integer();
    std::vector<KruskalEdge> edges;
    for (const auto& item : data.at("edges").array()) {
        const auto& e = item.array();
        edges.push_back({e[0].integer(), e[1].integer(), e[2].integer()});
    }
    std::sort(edges.begin(), edges.end(), [](const KruskalEdge& a, const KruskalEdge& b) {
        return a.w < b.w;
    });
    std::vector<long long> parent(n), size(n, 1);
    for (long long i = 0; i < n; ++i) parent[i] = i;
    long long total = 0, used = 0;
    for (const auto& edge : edges) {
        long long ru = kruskal_find(parent, edge.u);
        long long rv = kruskal_find(parent, edge.v);
        if (ru == rv) continue;
        if (size[ru] < size[rv]) std::swap(ru, rv);
        parent[rv] = ru;
        size[ru] += size[rv];
        total += edge.w;
        ++used;
        if (used == n - 1) break;
    }
    if (used != n - 1) throw std::runtime_error("graph must be connected");
    return Json(total);
}
`,
};
