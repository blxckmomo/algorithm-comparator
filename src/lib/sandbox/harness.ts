export const supervisorSource = String.raw`import ctypes
import os
import resource
import sys

def limit(kind, soft, hard=None):
    try:
        resource.setrlimit(kind, (soft, soft if hard is None else hard))
    except (ValueError, OSError):
        pass

def main():
    separator = sys.argv.index("--")
    memory = int(sys.argv[1])
    cpu = int(sys.argv[2])
    command = sys.argv[separator + 1:]
    workdir = os.getcwd()
    os.setsid()
    limit(resource.RLIMIT_CPU, cpu, cpu + 1)
    limit(resource.RLIMIT_AS, memory, memory)
    limit(resource.RLIMIT_FSIZE, 2 * 1024 * 1024, 2 * 1024 * 1024)
    limit(resource.RLIMIT_NOFILE, 48, 48)
    limit(resource.RLIMIT_CORE, 0, 0)
    network_namespace = False
    try:
        libc = ctypes.CDLL(None, use_errno=True)
        CLONE_NEWNET = 0x40000000
        network_namespace = libc.unshare(CLONE_NEWNET) == 0
    except Exception:
        network_namespace = False
    try:
        with open(".network-namespace", "w") as marker:
            marker.write("yes" if network_namespace else "no")
    except OSError:
        pass
    environment = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "HOME": workdir,
        "TMPDIR": workdir,
        "JAVA_TOOL_OPTIONS": "-Djava.awt.headless=true",
    }
    os.execvpe(command[0], command, environment)

if __name__ == "__main__":
    main()
`;

export const pythonHarnessSuffix = String.raw`

if __name__ == "__main__":
    import json
    import resource
    import sys
    import time
    sys.setrecursionlimit(20000)
    try:
        payload = json.loads(sys.stdin.read())
        started = time.perf_counter_ns()
        try:
            value = solve(payload)
            elapsed = (time.perf_counter_ns() - started) / 1000000
            encoded = json.dumps(value, allow_nan=False, separators=(",", ":"))
            memory = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            print(json.dumps({"ok": True, "result": value, "milliseconds": elapsed, "memoryKiB": memory}, allow_nan=False, separators=(",", ":")))
        except Exception as error:
            elapsed = (time.perf_counter_ns() - started) / 1000000
            memory = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            print(json.dumps({"ok": False, "error": type(error).__name__ + ": " + str(error), "milliseconds": elapsed, "memoryKiB": memory}, separators=(",", ":")))
    except Exception as outer_error:
        print(json.dumps({"ok": False, "error": "Harness: " + str(outer_error), "milliseconds": 0, "memoryKiB": None}, separators=(",", ":")))
`;

export const cppHarnessPrefix = String.raw`#include <algorithm>
#include <cctype>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <deque>
#include <functional>
#include <iostream>
#include <map>
#include <queue>
#include <sstream>
#include <stdexcept>
#include <string>
#include <sys/resource.h>
#include <utility>
#include <vector>

struct Json {
    enum Type { NUL, BOOL, NUMBER, STRING, ARRAY, OBJECT } type = NUL;
    bool boolean = false;
    double number = 0;
    std::string text;
    std::vector<Json> items;
    std::map<std::string, Json> fields;
    Json() {}
    Json(long long value) : type(NUMBER), number((double)value) {}
    Json(int value) : type(NUMBER), number((double)value) {}
    Json(double value) : type(NUMBER), number(value) {}
    Json(const std::vector<long long>& values) : type(ARRAY) {
        for (long long value : values) items.emplace_back(value);
    }
    long long integer() const { return (long long)number; }
    std::vector<Json>& array() {
        if (type != ARRAY) throw std::runtime_error("expected array");
        return items;
    }
    const std::vector<Json>& array() const {
        if (type != ARRAY) throw std::runtime_error("expected array");
        return items;
    }
    std::map<std::string, Json>& object() {
        if (type != OBJECT) throw std::runtime_error("expected object");
        return fields;
    }
    Json& at(const std::string& key) {
        if (type != OBJECT || !fields.count(key)) throw std::runtime_error("missing key: " + key);
        return fields[key];
    }
    const Json& at(const std::string& key) const {
        if (type != OBJECT || !fields.count(key)) throw std::runtime_error("missing key: " + key);
        return fields.at(key);
    }
};

struct JsonParser {
    const std::string& source;
    std::size_t position = 0;
    JsonParser(const std::string& input) : source(input) {}
    void whitespace() { while (position < source.size() && std::isspace((unsigned char)source[position])) ++position; }
    bool consume(char c) {
        whitespace();
        if (position < source.size() && source[position] == c) { ++position; return true; }
        return false;
    }
    std::string parseString() {
        whitespace();
        if (position >= source.size() || source[position++] != '"') throw std::runtime_error("expected string");
        std::string out;
        while (position < source.size()) {
            char c = source[position++];
            if (c == '"') return out;
            if (c == '\\') {
                if (position >= source.size()) break;
                char escaped = source[position++];
                if (escaped == 'n') out += '\n';
                else if (escaped == 'r') out += '\r';
                else if (escaped == 't') out += '\t';
                else out += escaped;
            } else out += c;
        }
        throw std::runtime_error("unterminated string");
    }
    Json value() {
        whitespace();
        if (position >= source.size()) throw std::runtime_error("unexpected end of JSON");
        char c = source[position];
        if (c == '{') {
            ++position;
            Json result; result.type = Json::OBJECT;
            whitespace();
            if (consume('}')) return result;
            while (true) {
                std::string key = parseString();
                if (!consume(':')) throw std::runtime_error("expected colon");
                result.fields[key] = value();
                if (consume('}')) return result;
                if (!consume(',')) throw std::runtime_error("expected comma");
            }
        }
        if (c == '[') {
            ++position;
            Json result; result.type = Json::ARRAY;
            if (consume(']')) return result;
            while (true) {
                result.items.push_back(value());
                if (consume(']')) return result;
                if (!consume(',')) throw std::runtime_error("expected comma");
            }
        }
        if (source.compare(position, 4, "null") == 0) { position += 4; return Json(); }
        if (source.compare(position, 4, "true") == 0) {
            position += 4; Json result; result.type = Json::BOOL; result.boolean = true; return result;
        }
        if (source.compare(position, 5, "false") == 0) {
            position += 5; Json result; result.type = Json::BOOL; result.boolean = false; return result;
        }
        if (c == '"') {
            Json result; result.type = Json::STRING; result.text = parseString(); return result;
        }
        std::size_t start = position;
        if (source[position] == '-') ++position;
        while (position < source.size() && std::isdigit((unsigned char)source[position])) ++position;
        if (position < source.size() && source[position] == '.') {
            ++position;
            while (position < source.size() && std::isdigit((unsigned char)source[position])) ++position;
        }
        if (position < source.size() && (source[position] == 'e' || source[position] == 'E')) {
            ++position;
            if (position < source.size() && (source[position] == '+' || source[position] == '-')) ++position;
            while (position < source.size() && std::isdigit((unsigned char)source[position])) ++position;
        }
        if (start == position) throw std::runtime_error("invalid JSON value");
        Json result; result.type = Json::NUMBER;
        result.number = std::stod(source.substr(start, position - start));
        return result;
    }
};

static std::string jsonEscape(const std::string& value) {
    std::string out;
    for (char c : value) {
        if (c == '"' || c == '\\') { out += '\\'; out += c; }
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else if (c == '\t') out += "\\t";
        else out += c;
    }
    return out;
}

static std::string jsonString(const Json& value) {
    if (value.type == Json::NUL) return "null";
    if (value.type == Json::BOOL) return value.boolean ? "true" : "false";
    if (value.type == Json::NUMBER) {
        if (!std::isfinite(value.number)) throw std::runtime_error("non-finite output");
        std::ostringstream stream;
        if (value.number == std::floor(value.number) && std::abs(value.number) <= 9007199254740991.0) stream << (long long)value.number;
        else stream.precision(15), stream << value.number;
        return stream.str();
    }
    if (value.type == Json::STRING) return "\"" + jsonEscape(value.text) + "\"";
    if (value.type == Json::ARRAY) {
        std::string out = "[";
        for (std::size_t i = 0; i < value.items.size(); ++i) {
            if (i) out += ",";
            out += jsonString(value.items[i]);
        }
        return out + "]";
    }
    std::string out = "{";
    bool first = true;
    for (const auto& entry : value.fields) {
        if (!first) out += ",";
        first = false;
        out += "\"" + jsonEscape(entry.first) + "\":" + jsonString(entry.second);
    }
    return out + "}";
}
`;

export const cppHarnessSuffix = String.raw`

int main() {
    try {
        std::ostringstream buffer;
        buffer << std::cin.rdbuf();
        Json input = JsonParser(buffer.str()).value();
        auto started = std::chrono::steady_clock::now();
        try {
            Json result = solve(input);
            auto ended = std::chrono::steady_clock::now();
            double milliseconds = std::chrono::duration<double, std::milli>(ended - started).count();
            struct rusage usage;
            getrusage(RUSAGE_SELF, &usage);
            std::cout << "{\"ok\":true,\"result\":" << jsonString(result)
                      << ",\"milliseconds\":" << milliseconds << ",\"memoryKiB\":" << usage.ru_maxrss << "}" << std::endl;
        } catch (const std::exception& error) {
            auto ended = std::chrono::steady_clock::now();
            double milliseconds = std::chrono::duration<double, std::milli>(ended - started).count();
            struct rusage usage;
            getrusage(RUSAGE_SELF, &usage);
            std::cout << "{\"ok\":false,\"error\":\"" << jsonEscape(error.what())
                      << "\",\"milliseconds\":" << milliseconds << ",\"memoryKiB\":" << usage.ru_maxrss << "}" << std::endl;
        }
    } catch (const std::exception& error) {
        std::cout << "{\"ok\":false,\"error\":\"Harness: " << jsonEscape(error.what()) << "\",\"milliseconds\":0,\"memoryKiB\":null}" << std::endl;
    }
    return 0;
}
`;

export const javaRunnerSource = String.raw`import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class Runner {
    static class Parser {
        final String source;
        int position = 0;
        Parser(String source) { this.source = source; }
        void whitespace() { while (position < source.length() && Character.isWhitespace(source.charAt(position))) ++position; }
        boolean consume(char c) {
            whitespace();
            if (position < source.length() && source.charAt(position) == c) { ++position; return true; }
            return false;
        }
        String string() {
            whitespace();
            if (position >= source.length() || source.charAt(position++) != '"') throw new IllegalArgumentException("expected string");
            StringBuilder out = new StringBuilder();
            while (position < source.length()) {
                char c = source.charAt(position++);
                if (c == '"') return out.toString();
                if (c == '\\') {
                    char e = source.charAt(position++);
                    if (e == 'n') out.append('\n');
                    else if (e == 'r') out.append('\r');
                    else if (e == 't') out.append('\t');
                    else out.append(e);
                } else out.append(c);
            }
            throw new IllegalArgumentException("unterminated string");
        }
        Object value() {
            whitespace();
            if (position >= source.length()) throw new IllegalArgumentException("unexpected end");
            char c = source.charAt(position);
            if (c == '{') {
                ++position;
                Map<String, Object> map = new LinkedHashMap<>();
                if (consume('}')) return map;
                while (true) {
                    String key = string();
                    if (!consume(':')) throw new IllegalArgumentException("expected colon");
                    map.put(key, value());
                    if (consume('}')) return map;
                    if (!consume(',')) throw new IllegalArgumentException("expected comma");
                }
            }
            if (c == '[') {
                ++position;
                List<Object> list = new ArrayList<>();
                if (consume(']')) return list;
                while (true) {
                    list.add(value());
                    if (consume(']')) return list;
                    if (!consume(',')) throw new IllegalArgumentException("expected comma");
                }
            }
            if (source.startsWith("null", position)) { position += 4; return null; }
            if (source.startsWith("true", position)) { position += 4; return true; }
            if (source.startsWith("false", position)) { position += 5; return false; }
            if (c == '"') return string();
            int start = position;
            if (source.charAt(position) == '-') ++position;
            while (position < source.length() && Character.isDigit(source.charAt(position))) ++position;
            boolean decimal = false;
            if (position < source.length() && source.charAt(position) == '.') {
                decimal = true; ++position;
                while (position < source.length() && Character.isDigit(source.charAt(position))) ++position;
            }
            if (start == position) throw new IllegalArgumentException("invalid value");
            String token = source.substring(start, position);
            return decimal ? (Object) Double.parseDouble(token) : (Object) Long.parseLong(token);
        }
    }

    static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    static String json(Object value) {
        if (value == null) return "null";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Map<?, ?>) {
            StringBuilder out = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
                if (!first) out.append(',');
                first = false;
                out.append('"').append(escape(String.valueOf(entry.getKey()))).append("\":").append(json(entry.getValue()));
            }
            return out.append('}').toString();
        }
        if (value instanceof Iterable<?>) {
            StringBuilder out = new StringBuilder("[");
            boolean first = true;
            for (Object item : (Iterable<?>) value) {
                if (!first) out.append(',');
                first = false;
                out.append(json(item));
            }
            return out.append(']').toString();
        }
        return "\"" + escape(String.valueOf(value)) + "\"";
    }

    public static void main(String[] args) {
        try {
            byte[] bytes = System.in.readAllBytes();
            Object input = new Parser(new String(bytes, StandardCharsets.UTF_8)).value();
            long started = System.nanoTime();
            try {
                Object result = Algorithm.solve(input);
                double milliseconds = (System.nanoTime() - started) / 1000000.0;
                Runtime runtime = Runtime.getRuntime();
                long memory = (runtime.totalMemory() - runtime.freeMemory()) / 1024;
                System.out.println("{\"ok\":true,\"result\":" + json(result) + ",\"milliseconds\":" + milliseconds + ",\"memoryKiB\":" + memory + "}");
            } catch (Exception error) {
                double milliseconds = (System.nanoTime() - started) / 1000000.0;
                Runtime runtime = Runtime.getRuntime();
                long memory = (runtime.totalMemory() - runtime.freeMemory()) / 1024;
                System.out.println("{\"ok\":false,\"error\":\"" + escape(error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage())) + "\",\"milliseconds\":" + milliseconds + ",\"memoryKiB\":" + memory + "}");
            }
        } catch (Throwable error) {
            System.out.println("{\"ok\":false,\"error\":\"Harness: " + escape(String.valueOf(error.getMessage())) + "\",\"milliseconds\":0,\"memoryKiB\":null}");
        }
    }
}
`;
