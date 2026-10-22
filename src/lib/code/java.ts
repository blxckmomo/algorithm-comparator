export const javaImplementations: Record<string, string> = {
  "linear-search": `import java.util.*;

public class Algorithm {
    public static Object solve(Object data) {
        Map<?, ?> map = (Map<?, ?>) data;
        List<?> a = (List<?>) map.get("arr");
        long target = ((Number) map.get("target")).longValue();
        for (int i = 0; i < a.size(); ++i) {
            if (((Number) a.get(i)).longValue() == target) return (long) i;
        }
        return -1L;
    }
}
`,
  "binary-search": `import java.util.*;

public class Algorithm {
    public static Object solve(Object data) {
        Map<?, ?> map = (Map<?, ?>) data;
        List<?> a = (List<?>) map.get("arr");
        long target = ((Number) map.get("target")).longValue();
        int lo = 0, hi = a.size();
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (((Number) a.get(mid)).longValue() < target) lo = mid + 1;
            else hi = mid;
        }
        if (lo < a.size() && ((Number) a.get(lo)).longValue() == target) return (long) lo;
        return -1L;
    }
}
`,
  "bubble-sort": `import java.util.*;

public class Algorithm {
    static long num(Object value) { return ((Number) value).longValue(); }

    public static Object solve(Object data) {
        Map<?, ?> map = (Map<?, ?>) data;
        List<Object> a = (List<Object>) map.get("arr");
        for (int end = a.size() - 1; end > 0; --end) {
            boolean swapped = false;
            for (int j = 0; j < end; ++j) {
                if (num(a.get(j)) > num(a.get(j + 1))) {
                    Object tmp = a.get(j);
                    a.set(j, a.get(j + 1));
                    a.set(j + 1, tmp);
                    swapped = true;
                }
            }
            if (!swapped) break;
        }
        return a;
    }
}
`,
  "insertion-sort": `import java.util.*;

public class Algorithm {
    static long num(Object value) { return ((Number) value).longValue(); }

    public static Object solve(Object data) {
        Map<?, ?> map = (Map<?, ?>) data;
        List<Object> a = (List<Object>) map.get("arr");
        for (int i = 1; i < a.size(); ++i) {
            Object value = a.get(i);
            long number = num(value);
            int j = i - 1;
            while (j >= 0 && num(a.get(j)) > number) {
                a.set(j + 1, a.get(j));
                --j;
            }
            a.set(j + 1, value);
        }
        return a;
    }
}
`,
  "merge-sort": `import java.util.*;

public class Algorithm {
    static List<Long> merge_sort(List<Long> a) {
        if (a.size() <= 1) return new ArrayList<>(a);
        int mid = a.size() / 2;
        List<Long> left = merge_sort(new ArrayList<>(a.subList(0, mid)));
        List<Long> right = merge_sort(new ArrayList<>(a.subList(mid, a.size())));
        List<Long> merged = new ArrayList<>(a.size());
        int i = 0, j = 0;
        while (i < left.size() && j < right.size()) {
            if (left.get(i) <= right.get(j)) merged.add(left.get(i++));
            else merged.add(right.get(j++));
        }
        while (i < left.size()) merged.add(left.get(i++));
        while (j < right.size()) merged.add(right.get(j++));
        return merged;
    }

    public static Object solve(Object data) {
        Map<?, ?> map = (Map<?, ?>) data;
        List<Long> a = new ArrayList<>();
        for (Object x : (List<?>) map.get("arr")) a.add(((Number) x).longValue());
        return merge_sort(a);
    }
}
`,
  "quick-sort": `import java.util.*;

public class Algorithm {
    static long num(Object value) { return ((Number) value).longValue(); }

    static void quick_sort(List<Object> a, int lo, int hi) {
        if (lo >= hi) return;
        long pivot = num(a.get((lo + hi) / 2));
        int i = lo, j = hi;
        while (i <= j) {
            while (num(a.get(i)) < pivot) ++i;
            while (num(a.get(j)) > pivot) --j;
            if (i <= j) {
                Object tmp = a.get(i);
                a.set(i, a.get(j));
                a.set(j, tmp);
                ++i;
                --j;
            }
        }
        quick_sort(a, lo, j);
        quick_sort(a, i, hi);
    }

    public static Object solve(Object data) {
        Map<?, ?> map = (Map<?, ?>) data;
        List<Object> a = (List<Object>) map.get("arr");
        if (!a.isEmpty()) quick_sort(a, 0, a.size() - 1);
        return a;
    }
}
`,
  bfs: `import java.util.*;

public class Algorithm {
    public static Object solve(Object data) {
        Map<?, ?> map = (Map<?, ?>) data;
        List<?> adj = (List<?>) map.get("adj");
        int source = ((Number) map.get("source")).intValue();
        boolean[] seen = new boolean[adj.size()];
        Queue<Integer> queue = new ArrayDeque<>();
        List<Long> order = new ArrayList<>();
        seen[source] = true;
        queue.add(source);
        while (!queue.isEmpty()) {
            int u = queue.remove();
            order.add((long) u);
            for (Object item : (List<?>) adj.get(u)) {
                int v = ((Number) item).intValue();
                if (!seen[v]) {
                    seen[v] = true;
                    queue.add(v);
                }
            }
        }
        return order;
    }
}
`,
  dfs: `import java.util.*;

public class Algorithm {
    static void visit(int u, List<?> adj, boolean[] seen, List<Long> order) {
        seen[u] = true;
        order.add((long) u);
        for (Object item : (List<?>) adj.get(u)) {
            int v = ((Number) item).intValue();
            if (!seen[v]) visit(v, adj, seen, order);
        }
    }

    public static Object solve(Object data) {
        Map<?, ?> map = (Map<?, ?>) data;
        List<?> adj = (List<?>) map.get("adj");
        int source = ((Number) map.get("source")).intValue();
        boolean[] seen = new boolean[adj.size()];
        List<Long> order = new ArrayList<>();
        visit(source, adj, seen, order);
        return order;
    }
}
`,
  prim: `import java.util.*;

public class Algorithm {
    public static Object solve(Object data) {
        Map<?, ?> map = (Map<?, ?>) data;
        int n = ((Number) map.get("v")).intValue();
        int start = map.containsKey("start") ? ((Number) map.get("start")).intValue() : 0;
        List<List<long[]>> adj = new ArrayList<>();
        for (int i = 0; i < n; ++i) adj.add(new ArrayList<>());
        for (Object item : (List<?>) map.get("edges")) {
            List<?> e = (List<?>) item;
            int u = ((Number) e.get(0)).intValue();
            int v = ((Number) e.get(1)).intValue();
            long w = ((Number) e.get(2)).longValue();
            adj.get(u).add(new long[]{v, w});
            adj.get(v).add(new long[]{u, w});
        }
        PriorityQueue<long[]> heap = new PriorityQueue<>(
            Comparator.comparingLong((long[] e) -> e[0]).thenComparingLong(e -> e[1]));
        boolean[] inTree = new boolean[n];
        heap.add(new long[]{0, start});
        long total = 0;
        int visited = 0;
        while (!heap.isEmpty()) {
            long[] entry = heap.remove();
            long w = entry[0];
            int u = (int) entry[1];
            if (inTree[u]) continue;
            inTree[u] = true;
            total += w;
            ++visited;
            for (long[] edge : adj.get(u)) {
                if (!inTree[(int) edge[0]]) heap.add(new long[]{edge[1], edge[0]});
            }
        }
        if (visited != n) throw new IllegalArgumentException("graph must be connected");
        return total;
    }
}
`,
  kruskal: `import java.util.*;

public class Algorithm {
    static int find(int[] parent, int x) {
        if (parent[x] != x) parent[x] = find(parent, parent[x]);
        return parent[x];
    }

    public static Object solve(Object data) {
        Map<?, ?> map = (Map<?, ?>) data;
        int n = ((Number) map.get("v")).intValue();
        List<long[]> edges = new ArrayList<>();
        for (Object item : (List<?>) map.get("edges")) {
            List<?> e = (List<?>) item;
            edges.add(new long[]{((Number) e.get(0)).longValue(),
                ((Number) e.get(1)).longValue(), ((Number) e.get(2)).longValue()});
        }
        edges.sort(Comparator.comparingLong(e -> e[2]));
        int[] parent = new int[n];
        int[] size = new int[n];
        for (int i = 0; i < n; ++i) { parent[i] = i; size[i] = 1; }
        long total = 0;
        int used = 0;
        for (long[] edge : edges) {
            int ru = find(parent, (int) edge[0]);
            int rv = find(parent, (int) edge[1]);
            if (ru == rv) continue;
            if (size[ru] < size[rv]) { int tmp = ru; ru = rv; rv = tmp; }
            parent[rv] = ru;
            size[ru] += size[rv];
            total += edge[2];
            ++used;
            if (used == n - 1) break;
        }
        if (used != n - 1) throw new IllegalArgumentException("graph must be connected");
        return total;
    }
}
`,
};
